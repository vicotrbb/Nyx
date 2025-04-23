import { TaskGraph } from '../taskGraph';
import * as openaiTool from '../ai/openai';
import { NyxConfig } from '../../config/nyxConfig';
import { Task } from './task';
import { LoggerFunc } from './workerAgent';
import { defaultLogger } from '../../utils/logger';
import { ToolDispatcher } from '../tools/dispatcher';
import { PLANNING_PROMPT } from '../prompts/planning';
import { z } from 'zod';
import { AgentTypes } from './agentTypes';

/**
 * TODOS:
 * - Make the planner agent use the prompt from the planning.ts file
 * - Make the planner return the plan as a JSON object using a zod schema
 * - Make the planner agent use the tools from the tools.ts file, dispatch it with the dispatcher, and reiterate on it until the plan is done.
 * - Make the planner also create the tasks for specific agents.
 *
 * - Change the orchestrator to execute the agents based on the plan, running them in parallel and in order of dependency based on the task graph.
 * - Create the new agents for testing, documentation, design and writting and modifying code and etc.
 * - Create an agent dispatcher, that will dispatch the agents based on the task plan.
 */

export class PlannerAgent {
  private config: NyxConfig;
  private dispatcher: ToolDispatcher;
  private logger: LoggerFunc;

  constructor(
    config: NyxConfig,
    dispatcher: ToolDispatcher,
    logger: LoggerFunc = defaultLogger
  ) {
    this.config = config;
    this.dispatcher = dispatcher;
    this.logger = logger;
  }

  async generatePlan(objective: string, context?: string): Promise<TaskGraph> {
    const systemPrompt = PLANNING_PROMPT;
    const userPrompt = `Objective: ${objective}\n\n${context ? `Context of current project state:\n${context}\n\n` : ''}Generate the JSON task plan:`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const plan = await openaiTool.chatCompletion(
      messages,
      {
        openaiApiKey: this.config.openaiApiKey,
        openaiModel: this.config.openaiModel,
        temperature: 0.1,
      },
      {
        responseType: 'json',
        schema: this.getPlanningSchema(),
      }
    );

    if (!plan) {
      throw new Error('PlannerAgent received no response from LLM.');
    }

    this.logger(
      'Raw LLM Plan Response:\n' + JSON.stringify(plan, null, 2),
      'info'
    );
    return this.parsePlan(plan.tasks);
  }

  private getPlanningSchema() {
    return z.object({
      tasks: z.array(
        z.object({
          id: z.number(),
          description: z.string(),
          dependencies: z.array(z.number()),
          agent: z.nativeEnum(AgentTypes),
        })
      ),
      done: z.boolean(),
    });
  }

  private parsePlan(tasks: any[]): TaskGraph {
    this.logger('Processing parsed plan items...', 'info');

    const taskGraph = new TaskGraph();
    const taskMap = new Map<number, Task>();
    const llmIdToTaskId = new Map<number, number>();

    for (const item of tasks) {
      if (
        typeof item?.id !== 'number' ||
        item.id < 1 ||
        Math.floor(item.id) !== item.id ||
        typeof item?.description !== 'string' ||
        item.description.trim() === '' ||
        !Array.isArray(item?.dependencies)
      ) {
        this.logger(
          'Invalid task item format found, skipping: ' + JSON.stringify(item),
          'warn'
        );

        continue;
      }

      if (llmIdToTaskId.has(item.id)) {
        this.logger(
          `Duplicate LLM task ID ${item.id} found, skipping duplicate.`,
          'warn'
        );

        continue;
      }

      const newTask = taskGraph.addTask(item.description.trim(), []);
      taskMap.set(item.id, newTask);
      llmIdToTaskId.set(item.id, newTask.id);

      this.logger(
        `Added task: [Internal ID: ${newTask.id}, LLM ID: ${item.id}] Desc: ${newTask.description}`,
        'info'
      );
    }

    this.logger('Linking task dependencies...', 'info');
    for (const item of tasks) {
      if (!llmIdToTaskId.has(item.id)) {
        continue;
      }

      const task = taskMap.get(item.id);

      if (task && Array.isArray(item.dependencies)) {
        const internalDepIds = item.dependencies
          .map((depLlmId: any): number | undefined => {
            if (typeof depLlmId !== 'number') {
              this.logger(
                `Invalid dependency ID type (${typeof depLlmId}) for task ${item.id}, skipping.`,
                'warn'
              );

              return undefined;
            }

            const internalDepId = llmIdToTaskId.get(depLlmId);

            if (internalDepId === undefined) {
              this.logger(
                `Dependency LLM ID ${depLlmId} not found for task ${item.id}, skipping.`,
                'warn'
              );
            }

            return internalDepId;
          })
          .filter((id: number | undefined): id is number => id !== undefined);

        if (internalDepIds.length > 0) {
          task.dependsOn = internalDepIds;

          this.logger(
            `Linked dependencies for task ${task.id}: [${task.dependsOn.join(', ')}]`,
            'info'
          );
        }
      }
    }

    this.logger('Validating task graph for cycles...', 'info');

    try {
      this.validateDAG(taskGraph);
      this.logger('Task graph DAG validation successful.', 'info');
    } catch (error: any) {
      this.logger('DAG Validation Error: ' + error.message, 'error');
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
          this.logger(
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
