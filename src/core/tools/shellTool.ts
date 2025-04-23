import { exec } from 'child_process';
import { promisify } from 'util';
import { LoggerFunc } from '../agents/workerAgent';
import { defaultLogger } from '../../utils/logger';

const execPromise = promisify(exec);

// TODO: Add sandboxing and safety checks for commands

export interface ShellCommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: Error;
}

export interface ShellCommandArgs {
  command: string;
  cwd?: string;
}

export async function runCommand(
  args: ShellCommandArgs,
  logger: LoggerFunc = defaultLogger
): Promise<ShellCommandResult> {
  const { command, cwd } = args;

  logger(`Executing command: ${command}${cwd ? ' in ' + cwd : ''}`);

  try {
    const { stdout, stderr } = await execPromise(command, { cwd });

    return {
      stdout,
      stderr,
      code: 0,
    };
  } catch (error: any) {
    logger(`Command failed: ${command}\nError: ${error.message}`, 'error');

    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      code: typeof error.code === 'number' ? error.code : 1,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
