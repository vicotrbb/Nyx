import { TaskGraph } from '../taskGraph';
import * as openaiTool from '../tools/openaiTool';
import { NyxConfig } from '../../config/nyxConfig';
import { Task } from './task';
import { LoggerFunc } from './workerAgent';
import { defaultLogger } from '../../utils/logger';

export class PlannerAgent {
  private config: NyxConfig;
  private log: LoggerFunc;

  constructor(config: NyxConfig, logger: LoggerFunc = defaultLogger) {
    this.config = config;
    this.log = logger;
  }

  async generatePlan(objective: string, context?: string): Promise<TaskGraph> {
    const systemPrompt = `You are an expert software project planning assistant. 
Break down the user's objective into a series of actionable development tasks. 
Consider the provided context if available. 
Output ONLY the plan as a valid JSON array of task objects. 
Each task object must have the following properties: 
- 'id': A unique integer ID for the task (start from 1). 
- 'description': A concise string describing the task. 
- 'dependencies': An array of integer IDs representing the tasks that must be completed before this task can start. Use an empty array [] for tasks with no dependencies. 
Ensure the dependencies form a valid Directed Acyclic Graph (DAG). Do not include any preamble, explanation, or markdown formatting around the JSON.`;

    const userPrompt = `Objective: ${objective}\n\n${context ? `Context of current project state:\n${context}\n\n` : ''}Generate the JSON task plan:`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const planJsonText = await openaiTool.chatCompletion(messages, {
      openaiApiKey: this.config.openaiApiKey,
      openaiModel: this.config.openaiModel,
      temperature: 0.1,
    });

    if (!planJsonText) {
      throw new Error('PlannerAgent received no response from LLM.');
    }

    this.log('Raw LLM Plan Response:\n' + planJsonText, 'info');
    return this.parsePlanJson(planJsonText);
  }

  private parsePlanJson(planJsonText: string): TaskGraph {
    this.log('Parsing LLM plan JSON...', 'info');
    const taskGraph = new TaskGraph();

    let parsedPlan: any[];

    try {
      const cleanJsonText = planJsonText.replace(/```json\n|```/g, '').trim();
      parsedPlan = JSON.parse(cleanJsonText);

      if (!Array.isArray(parsedPlan)) {
        throw new Error('Parsed JSON is not an array.');
      }
    } catch (error: any) {
      this.log(
        'Failed to parse LLM response as JSON: ' + error.message,
        'error'
      );

      const jsonMatch = planJsonText.match(/\[[\s\S]*?\]/);

      if (jsonMatch && jsonMatch[0]) {
        this.log('Attempting fallback JSON parsing from regex match.');

        try {
          parsedPlan = JSON.parse(jsonMatch[0]);

          if (!Array.isArray(parsedPlan)) {
            throw new Error('Fallback parsed JSON is not an array.');
          }

          this.log(
            'Successfully extracted JSON array from fallback regex.',
            'info'
          );
        } catch (fallbackError: any) {
          this.log(
            'Fallback JSON parsing also failed: ' + fallbackError.message,
            'error'
          );

          throw new Error(
            `Failed to parse plan JSON from LLM response. Raw response: ${planJsonText}`
          );
        }
      } else {
        throw new Error(
          `LLM response was not valid JSON and no JSON array found. Raw response: ${planJsonText}`
        );
      }
    }

    const taskMap = new Map<number, Task>();
    const llmIdToTaskId = new Map<number, number>();
    this.log('Processing parsed plan items...', 'info');

    for (const item of parsedPlan) {
      if (
        typeof item?.id !== 'number' ||
        item.id < 1 ||
        Math.floor(item.id) !== item.id ||
        typeof item?.description !== 'string' ||
        item.description.trim() === '' ||
        !Array.isArray(item?.dependencies)
      ) {
        this.log(
          'Invalid task item format found, skipping: ' + JSON.stringify(item),
          'warn'
        );

        continue;
      }

      if (llmIdToTaskId.has(item.id)) {
        this.log(
          `Duplicate LLM task ID ${item.id} found, skipping duplicate.`,
          'warn'
        );

        continue;
      }

      const newTask = taskGraph.addTask(item.description.trim(), []);
      taskMap.set(item.id, newTask);
      llmIdToTaskId.set(item.id, newTask.id);

      this.log(
        `Added task: [Internal ID: ${newTask.id}, LLM ID: ${item.id}] Desc: ${newTask.description}`,
        'info'
      );
    }

    this.log('Linking task dependencies...', 'info');
    for (const item of parsedPlan) {
      if (!llmIdToTaskId.has(item.id)) {
        continue;
      }

      const task = taskMap.get(item.id);

      if (task && Array.isArray(item.dependencies)) {
        const internalDepIds = item.dependencies
          .map((depLlmId: any): number | undefined => {
            if (typeof depLlmId !== 'number') {
              this.log(
                `Invalid dependency ID type (${typeof depLlmId}) for task ${item.id}, skipping.`,
                'warn'
              );

              return undefined;
            }

            const internalDepId = llmIdToTaskId.get(depLlmId);

            if (internalDepId === undefined) {
              this.log(
                `Dependency LLM ID ${depLlmId} not found for task ${item.id}, skipping.`,
                'warn'
              );
            }

            return internalDepId;
          })
          .filter((id: number | undefined): id is number => id !== undefined);

        if (internalDepIds.length > 0) {
          task.dependsOn = internalDepIds;

          this.log(
            `Linked dependencies for task ${task.id}: [${task.dependsOn.join(', ')}]`,
            'info'
          );
        }
      }
    }

    this.log('Validating task graph for cycles...', 'info');

    try {
      this.validateDAG(taskGraph);
      this.log('Task graph DAG validation successful.', 'info');
    } catch (error: any) {
      this.log('DAG Validation Error: ' + error.message, 'error');
      throw new Error(`Invalid task plan: ${error.message}`);
    }

    if (taskGraph.getAllTasks().length === 0) {
      throw new Error(
        'PlannerAgent failed to create any tasks from the objective.'
      );
    }

    return taskGraph;
  }

  private validateDAG(taskGraph: TaskGraph): void {
    const tasks = taskGraph.getAllTasks();
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const inDegree = new Map<number, number>();
    const adj = new Map<number, number[]>();

    for (const task of tasks) {
      inDegree.set(task.id, 0);
      adj.set(task.id, []);
    }

    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        if (taskMap.has(depId)) {
          adj.get(depId)?.push(task.id);
          inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        } else {
          this.log(
            `Task ${task.id} lists dependency ${depId} which does not exist in the graph.`,
            'warn'
          );

          throw new Error(
            `Task ${task.id} has an invalid dependency ID: ${depId}`
          );
        }
      }
    }

    const queue: number[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    let count = 0;
    while (queue.length > 0) {
      const u = queue.shift()!;
      count++;

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        const currentDegree = (inDegree.get(v) || 0) - 1;
        inDegree.set(v, currentDegree);

        if (currentDegree === 0) {
          queue.push(v);
        }
      }
    }

    if (count !== tasks.length) {
      const cyclicNodes = tasks.filter((t) => (inDegree.get(t.id) || 0) > 0);
      const cyclicNodeIds = cyclicNodes.map((t) => t.id);

      throw new Error(
        `Cycle detected in task dependencies. Involved node IDs might include: ${cyclicNodeIds.join(', ')}`
      );
    }
  }
}
