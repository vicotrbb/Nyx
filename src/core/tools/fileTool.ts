import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerFunc } from '../agents/workerAgent';
import { defaultLogger } from '../../utils/logger';

// Interfaces for tool arguments
interface FileToolBaseArgs {
  filePath: string;
  workspaceDir?: string;
}

interface WriteFileArgs extends FileToolBaseArgs {
  content: string;
}

interface AppendFileArgs extends FileToolBaseArgs {
  content: string;
}

interface EditFileArgs extends FileToolBaseArgs {
  instructions: string;
}

// TODO: Add more robust sandboxing (e.g., check resolved path starts with workspaceDir)

function resolvePath(workspaceDir: string, filePath: string): string {
  const absolutePath = path.resolve(workspaceDir, filePath);

  if (!absolutePath.startsWith(path.resolve(workspaceDir))) {
    throw new Error(
      `Path is outside the allowed workspace directory: ${filePath}`
    );
  }

  return absolutePath;
}

export async function readFile(
  args: FileToolBaseArgs,
  logger: LoggerFunc = defaultLogger
): Promise<string> {
  const resolvedPath = resolvePath(
    args.workspaceDir || process.cwd(),
    args.filePath
  );
  logger(`Attempting to read file: ${resolvedPath}`, 'info');

  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    logger(`Successfully read file: ${resolvedPath}`, 'info');

    return content;
  } catch (error: any) {
    logger(`Error reading file ${resolvedPath}: ${error.message}`, 'error');

    throw new Error(
      `Failed to read file: ${args.filePath} (Reason: ${error.message})`
    );
  }
}

export async function writeFile(
  args: WriteFileArgs,
  logger: LoggerFunc = defaultLogger
): Promise<void> {
  const resolvedPath = resolvePath(
    args.workspaceDir || process.cwd(),
    args.filePath
  );

  logger(
    `Attempting to write file: ${resolvedPath} (Length: ${args.content.length})`,
    'info'
  );

  try {
    const dir = path.dirname(resolvedPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolvedPath, args.content, 'utf-8');

    logger(`File written successfully: ${resolvedPath}`, 'info');
  } catch (error: any) {
    logger(`Error writing file ${resolvedPath}: ${error.message}`, 'error');

    throw new Error(
      `Failed to write file: ${args.filePath} (Reason: ${error.message})`
    );
  }
}

export async function appendFile(
  args: AppendFileArgs,
  logger: LoggerFunc = defaultLogger
): Promise<void> {
  const resolvedPath = resolvePath(
    args.workspaceDir || process.cwd(),
    args.filePath
  );

  logger(
    `Attempting to append to file: ${resolvedPath} (Length: ${args.content.length})`,
    'info'
  );

  try {
    const dir = path.dirname(resolvedPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(resolvedPath, args.content, 'utf-8');

    logger(`Content appended successfully to: ${resolvedPath}`, 'info');
  } catch (error: any) {
    logger(
      `Error appending to file ${resolvedPath}: ${error.message}`,
      'error'
    );

    throw new Error(
      `Failed to append to file: ${args.filePath} (Reason: ${error.message})`
    );
  }
}

export async function fileExists(
  args: FileToolBaseArgs,
  logger: LoggerFunc = defaultLogger
): Promise<boolean> {
  const resolvedPath = resolvePath(
    args.workspaceDir || process.cwd(),
    args.filePath
  );

  try {
    await fs.access(resolvedPath);
    logger(`File exists: ${resolvedPath}`, 'info');

    return true;
  } catch {
    logger(`File does not exist: ${resolvedPath}`, 'info');

    return false;
  }
}

/**
 * Edits a file based on instructions.
 * Placeholder - requires actual diff/patch logic or LLM intervention.
 */
export async function editFile(
  args: EditFileArgs,
  logger: LoggerFunc = defaultLogger
): Promise<void> {
  const resolvedPath = resolvePath(
    args.workspaceDir || process.cwd(),
    args.filePath
  );

  logger(`Attempting to edit file: ${resolvedPath}`, 'info');
  logger(`Edit instructions: ${args.instructions}`, 'info');

  // TODO: Implement actual file editing logic.
  // This might involve:
  // 1. Reading the file content.
  // 2. Sending content + instructions to LLM to get modified content or a patch.
  // 3. Applying the changes (e.g., writing modified content or applying patch).
  // For now, just log and throw NotImplemented.

  logger('File editing not yet implemented.', 'warn');

  throw new Error(
    `File editing functionality not implemented for ${args.filePath}.`
  );
}
