import { TaskGraph } from './taskGraph';
import { SessionMemory } from './memory/sessionMemory';
import { NyxConfig } from '../config/nyxConfig';
import { LockManager } from './tools/lockManager';
import { Dashboard } from './ui/dashboard';
import { EventEmitter } from 'events';
import { Task, TaskStatus } from './agents/task';
import { PlannerAgent } from './agents/plannerAgent';
import { WorkerAgent, TaskResult } from './agents/workerAgent';

export interface OrchestratorStats {
  startTime: number;
  elapsedSeconds: number;
  llmCalls: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  activeAgents: { [taskId: number]: string };
}

// TODO: Add comprehensive unit and integration tests for Orchestrator logic

/**
 * The central orchestrator for Nyx.
 * Manages the overall workflow from planning to execution.
 * Implemented as a Singleton to ensure a single instance coordinates the session.
 */
export class Orchestrator extends EventEmitter {
  private static instance: Orchestrator;

  private objective: string | undefined;
  private tasks: TaskGraph | undefined;
  private memory!: SessionMemory;
  private config!: NyxConfig;
  private lockManager!: LockManager;
  private dashboard: Dashboard | null = null;
  private planner!: PlannerAgent;
  private maxRetries = 3;

  private stats!: OrchestratorStats;
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Private constructor to enforce Singleton pattern.
   */
  private constructor() {
    super();
    this.memory = new SessionMemory();
    this.lockManager = new LockManager(this.log.bind(this));
  }

  /**
   * Gets the singleton instance of the Orchestrator.
   * @returns {Orchestrator} The singleton instance.
   */
  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }

    return Orchestrator.instance;
  }

  public initialize(config: NyxConfig): void {
    this.config = config;
    this.memory.clear();
    this.initializeUI(this.config.useDashboard);
    this.setupCommonListeners();
  }

  public incrementLlmCallCount(): void {
    if (!this.stats) {
      return;
    }

    this.stats.llmCalls++;
    this.emitStatsUpdate();
  }

  private emitStatsUpdate(): void {
    if (!this.stats) {
      return;
    }

    this.stats.elapsedSeconds = Math.floor(
      (Date.now() - this.stats.startTime) / 1000
    );

    this.stats.tasksCompleted =
      this.tasks?.getAllTasks().filter((t) => t.status === 'completed')
        .length ?? 0;

    this.stats.tasksFailed =
      this.tasks?.getAllTasks().filter((t) => t.status === 'failed').length ??
      0;

    this.stats.tasksTotal = this.tasks?.getAllTasks().length ?? 0;
    this.emit('statsUpdate', { ...this.stats });
  }

  async startProcessingObjective(objective: string): Promise<void> {
    if (!this.config || !this.lockManager) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    this.objective = objective;
    this.memory.addLog('objective', { objective });
    this.planner = new PlannerAgent(this.config, this.log.bind(this));

    this.log(`Processing objective: ${this.objective}`);
    this.log(`Using config: ${JSON.stringify(this.config)}`);

    this.stats = {
      startTime: Date.now(),
      elapsedSeconds: 0,
      llmCalls: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      activeAgents: {},
    };

    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
    }

    this.statsUpdateInterval = setInterval(() => this.emitStatsUpdate(), 1000);

    try {
      this.log('Planning tasks...');
      this.tasks = await this.planTasks();
      this.stats.tasksTotal = this.tasks.getAllTasks().length;

      this.emitStatsUpdate();
      this.emit('planReady', this.tasks.getAllTasks());
      this.log('Planning complete.');

      if (this.config.planOnly) {
        this.log('Plan only mode enabled. Skipping execution.');
        this.log('Final Plan:\n' + this.tasks.toString());
      } else {
        this.log('Starting task execution...');

        await this.executeTasks();

        this.log('All tasks executed.');
        this.emit('allTasksDone');
      }
    } catch (error: any) {
      this.log(`Error during objective processing: ${error.message}`, 'error');
      this.emit('orchestrationFailed', error);
    } finally {
      if (this.statsUpdateInterval) {
        clearInterval(this.statsUpdateInterval);
      }

      this.statsUpdateInterval = null;

      if (this.stats) {
        this.emitStatsUpdate();
      }

      this.log('Objective processing finished.');
    }
  }

  private initializeUI(useDashboard: boolean | undefined): void {
    if (useDashboard) {
      try {
        this.dashboard = new Dashboard(this);
        this.log('Dashboard UI initialized successfully.', 'info');
      } catch (error: any) {
        console.error(
          'FATAL: Failed to initialize Dashboard UI:',
          error.message
        );

        this.dashboard = null;
        throw new Error(`Dashboard initialization failed: ${error.message}`);
      }
    } else {
      this.dashboard = null;
      console.log('Running in headless mode (no dashboard).');
    }
  }

  private setupCommonListeners(): void {
    this.removeAllListeners();

    this.on('log', (message, level) => this.dashboard?.log(message));
    this.on('planReady', (tasks: Task[]) => this.dashboard?.updateTasks(tasks));
    this.on(
      'taskStatusUpdate',
      ({ id, status }: { id: number; status: TaskStatus }) => {
        if (this.tasks && this.dashboard) {
          this.dashboard.markTaskStatus(id, status, this.tasks.getAllTasks());
        }
      }
    );

    this.on('statsUpdate', (stats: OrchestratorStats) => {
      this.dashboard?.updateStats(stats);
    });

    this.on(
      'agentStatusUpdate',
      (activeAgents: { [taskId: number]: string }) => {
        this.dashboard?.updateAgentStatus(activeAgents);
      }
    );

    if (!this.dashboard) {
      this.on('log', (message, level) => {
        const prefix =
          level === 'error' ? 'ERROR: ' : level === 'warn' ? 'WARN: ' : '';

        console.log(prefix + message);
      });

      this.on('planReady', (tasks: Task[]) =>
        console.log(`Plan generated (${tasks.length} tasks).`)
      );

      this.on(
        'taskStatusUpdate',
        ({ id, status }: { id: number; status: TaskStatus }) => {
          console.log(`Task ${id} status changed to: ${status}`);
        }
      );

      this.on('allTasksDone', () => console.log('Execution finished.'));
      this.on('statsUpdate', (stats: OrchestratorStats) => {
        console.log(
          `[Stats] Elapsed: ${stats.elapsedSeconds}s | Tasks: ${stats.tasksCompleted}/${stats.tasksTotal} | Failed: ${stats.tasksFailed} | LLM Calls: ${stats.llmCalls}`
        );
      });

      this.on(
        'agentStatusUpdate',
        (activeAgents: { [taskId: number]: string }) => {
          console.log(`[Agents] Active: ${JSON.stringify(activeAgents)}`);
        }
      );

      this.on('orchestrationFailed', (error) =>
        console.error('Orchestration Failed Event Received')
      );
    }
  }

  private log(
    message: string,
    level: 'info' | 'error' | 'warn' = 'info'
  ): void {
    this.memory.addLog('log', { message, level });
    this.emit('log', message, level);
  }

  private async planTasks(): Promise<TaskGraph> {
    if (!this.objective) {
      throw new Error('Cannot plan without an objective.');
    }

    this.incrementLlmCallCount();

    const contextSummary = this.memory.getContextSummary();
    const taskGraph = await this.planner.generatePlan(
      this.objective,
      contextSummary
    );

    return taskGraph;
  }

  private async executeTasks(): Promise<void> {
    if (!this.tasks) {
      throw new Error('Cannot execute without a task plan.');
    }

    this.log('Executing tasks...');
    const worker = new WorkerAgent(
      this.config,
      this.lockManager,
      () => this.incrementLlmCallCount(),
      this.log.bind(this)
    );

    let availableTasks = this.tasks.getNextTasks();
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    while (
      this.tasks
        .getAllTasks()
        .some((t) => t.status === 'pending' || t.status === 'in_progress')
    ) {
      availableTasks = this.tasks.getNextTasks();

      if (availableTasks.length === 0) {
        const inProgressCount = this.tasks
          .getAllTasks()
          .filter((t) => t.status === 'in_progress').length;

        const pendingCount = this.tasks.getPendingTasks().length;

        if (inProgressCount === 0 && pendingCount > 0) {
          this.log(
            'No tasks runnable, but pending tasks remain. Possible deadlock or cycle.',
            'warn'
          );

          consecutiveFailures++;

          if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
            this.log(
              'Too many consecutive waits/failures. Aborting execution.',
              'error'
            );

            throw new Error(
              'Task execution stuck, possible cycle or persistent failure.'
            );
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * consecutiveFailures)
          );

          continue;
        } else if (inProgressCount > 0) {
          this.log(`Waiting for ${inProgressCount} tasks to complete...`);

          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } else {
          break;
        }
      }

      consecutiveFailures = 0;
      const taskToRun = availableTasks[0];

      this.log(`Starting task ${taskToRun.id}: ${taskToRun.description}`);
      this.stats.activeAgents[taskToRun.id] = 'WorkerAgent';

      this.emit('agentStatusUpdate', { ...this.stats.activeAgents });
      this.tasks.markStatus(taskToRun.id, 'in_progress');

      this.emit('taskStatusUpdate', {
        id: taskToRun.id,
        status: 'in_progress',
      });
      this.emitStatsUpdate();

      try {
        const result: TaskResult = await worker.execute(taskToRun);
        const newStatus: TaskStatus = result.success ? 'completed' : 'failed';

        this.memory.addLog('task_result', { task: taskToRun, result });

        this.log(
          `Task ${taskToRun.id} finished with status: ${newStatus}${result.message ? `: ${result.message}` : ''}`
        );

        this.tasks.markStatus(taskToRun.id, newStatus, result);
        delete this.stats.activeAgents[taskToRun.id];

        this.emit('agentStatusUpdate', { ...this.stats.activeAgents });
        this.emit('taskStatusUpdate', { id: taskToRun.id, status: newStatus });
        this.emitStatsUpdate();

        if (!result.success) {
          const currentRetries = this.tasks.getTask(taskToRun.id)?.retries ?? 0;

          if (currentRetries <= this.maxRetries) {
            this.log(
              `Retrying task ${taskToRun.id} (attempt ${currentRetries}/${this.maxRetries})...`,
              'warn'
            );

            this.tasks.resetTaskForRetry(taskToRun.id);
            this.emit('taskStatusUpdate', {
              id: taskToRun.id,
              status: 'pending',
            });

            consecutiveFailures++;
          } else {
            this.log(`Task ${taskToRun.id} failed after max retries.`, 'error');
            this.log(
              `[Analysis Required] Task ${taskToRun.id} failed permanently. Error: ${result.message || 'Unknown'}`,
              'warn'
            );

            consecutiveFailures++;
          }
        }
      } catch (error: any) {
        this.log(
          `Critical error during task ${taskToRun.id} execution: ${error.message}`,
          'error'
        );

        this.tasks.markStatus(taskToRun.id, 'failed', { error: error.message });
        this.memory.addLog('task_result', {
          task: taskToRun,
          result: { success: false, message: error.message },
        });

        delete this.stats.activeAgents[taskToRun.id];
        this.emit('agentStatusUpdate', { ...this.stats.activeAgents });
        this.emit('taskStatusUpdate', { id: taskToRun.id, status: 'failed' });
        this.emitStatsUpdate();

        throw new Error(
          `Task ${taskToRun.id} failed critically: ${error.message}`
        );
      }
    }

    this.log('Task execution loop finished.');
  }
}
