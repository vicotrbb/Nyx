export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: number;
  description: string;
  dependsOn: number[];
  status: TaskStatus;
  result?: any;
  retries?: number;
}
