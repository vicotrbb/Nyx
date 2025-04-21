import { Task, TaskStatus } from './agents/task';

/**
 * Placeholder for the TaskGraph class.
 * Manages the collection of tasks and their dependencies.
 */
export class TaskGraph {
  private tasks: Task[] = [];
  private nextTaskId = 1;
  private taskMap: Map<number, Task> = new Map();

  constructor() {}

  addTask(description: string, dependsOn: number[] = []): Task {
    const newTask: Task = {
      id: this.nextTaskId++,
      description,
      dependsOn,
      status: 'pending',
      retries: 0,
    };

    this.tasks.push(newTask);
    this.taskMap.set(newTask.id, newTask);

    return newTask;
  }

  getTask(taskId: number): Task | undefined {
    return this.taskMap.get(taskId);
  }

  getAllTasks(): Task[] {
    return [...this.tasks];
  }

  getPendingTasks(): Task[] {
    return this.tasks.filter((task) => task.status === 'pending');
  }

  getNextTasks(): Task[] {
    return this.tasks.filter((task) => {
      if (task.status !== 'pending') {
        return false;
      }

      return task.dependsOn.every((depId) => {
        const depTask = this.taskMap.get(depId);
        return depTask && depTask.status === 'completed';
      });
    });
  }

  markStatus(taskId: number, status: TaskStatus, result?: any): boolean {
    const task = this.taskMap.get(taskId);

    if (task) {
      task.status = status;

      if (result !== undefined) {
        task.result = result;
      }

      if (status === 'failed' || status === 'in_progress') {
        task.retries = (task.retries ?? 0) + 1;
      }

      return true;
    }

    return false;
  }

  resetTaskForRetry(taskId: number): boolean {
    const task = this.taskMap.get(taskId);

    if (task && task.status === 'failed') {
      task.status = 'pending';
      return true;
    }

    return false;
  }

  toString(): string {
    return this.tasks
      .map(
        (t) =>
          `[${t.id}] ${t.description} (${t.status}) deps: [${t.dependsOn.join(', ')}]`
      )
      .join('\n');
  }
}
