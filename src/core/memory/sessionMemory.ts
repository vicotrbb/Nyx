/**
 * Placeholder for the SessionMemory class.
 * Handles storing and retrieving session context.
 */
import { Task } from '../agents/task';
import { TaskResult } from '../agents/workerAgent';

interface MemoryEntry {
  type: 'objective' | 'task_result' | 'log';
  timestamp: number;
  data: any;
}

export class SessionMemory {
  private memoryLog: MemoryEntry[] = [];
  private MAX_LOG_ENTRIES = 50;
  private SUMMARY_LENGTH = 1000;

  constructor() {}

  /**
   * Adds an entry to the session memory log.
   * @param type Type of the log entry.
   * @param data Associated data.
   */
  addEntry(type: MemoryEntry['type'], data: any): void {
    const entry: MemoryEntry = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.memoryLog.push(entry);

    if (this.memoryLog.length > this.MAX_LOG_ENTRIES) {
      this.memoryLog.shift();
    }
  }

  /**
   * Gets a summary of the recent session context.
   * @returns A string summarizing recent events.
   */
  getContextSummary(): string {
    let summary = 'Recent session events:\n';

    for (let i = this.memoryLog.length - 1; i >= 0; i--) {
      const entry = this.memoryLog[i];
      let entryStr = ` - [${entry.type}] `;

      switch (entry.type) {
        case 'objective':
          entryStr += `Objective received: ${entry.data.objective}`;
          break;

        case 'task_result':
          const task = entry.data.task as Task;
          const result = entry.data.result as TaskResult;
          entryStr +=
            `Task ${task.id} (${task.description.substring(0, 30)}...) finished: ${result.success ? 'Success' : 'Failed'}${result.message ? ' - ' + result.message : ''}`.substring(
              0,
              150
            );
          break;

        case 'log':
          entryStr += `${entry.data.message}`.substring(0, 150);
          break;
      }

      if (summary.length + entryStr.length < this.SUMMARY_LENGTH) {
        summary += entryStr + '\n';
      } else {
        summary += '... (summary truncated)\n';
        break;
      }
    }

    return summary;
  }

  /**
   * Clears the memory log.
   */
  clear(): void {
    this.memoryLog = [];
  }
}
