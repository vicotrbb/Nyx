import { Task } from './task';
import { NyxConfig } from '../../config/nyxConfig';
import { LockManager } from '../tools/lockManager';
import * as openaiTool from '../ai/openai';
import * as fileTool from '../tools/fileTool';
import * as shellTool from '../tools/shellTool';
import path from 'path';
import { defaultLogger } from '../../utils/logger';

export interface TaskResult {
  success: boolean;
  message?: string;
  artifacts?: string[];
  output?: string;
}

export type LoggerFunc = (
  message: string,
  level?: 'info' | 'warn' | 'error'
) => void;

export class WorkerAgent {
  private config: NyxConfig;
  private lockManager: LockManager | undefined;
  private incrementLlmCalls: () => void;
  private log: LoggerFunc;
  private MAX_CONTEXT_FILES = 3;
  private MAX_FILE_CONTEXT_LENGTH = 2000;

  constructor(
    config: NyxConfig,
    lockManager?: LockManager,
    incrementLlmCalls?: () => void,
    logger: LoggerFunc = defaultLogger
  ) {
    this.config = config;
    this.lockManager = lockManager;
    this.incrementLlmCalls = incrementLlmCalls || (() => {});
    this.log = logger;
  }

  /**
   * Executes a given task.
   * This method should be implemented by specific agent types or
   * contain logic to dispatch based on task type.
   * @param {Task} task The task to execute.
   * @returns {Promise<TaskResult>} The result of the execution.
   */
  async execute(task: Task): Promise<TaskResult> {
    this.log(
      `WorkerAgent executing task ${task.id}: ${task.description}`,
      'info'
    );

    try {
      const descriptionLower = task.description.toLowerCase();

      if (
        descriptionLower.includes('create file') ||
        descriptionLower.includes('write file')
      ) {
        this.log(`Task ${task.id} identified as file write task.`, 'info');
        return await this.handleFileWriteTask(task);
      }

      if (
        descriptionLower.includes('edit file') ||
        descriptionLower.includes('modify file') ||
        descriptionLower.includes('update file')
      ) {
        this.log(`Task ${task.id} identified as file edit task.`, 'info');
        return await this.handleEditFileTask(task);
      }

      if (
        descriptionLower.includes('run command') ||
        descriptionLower.includes('execute')
      ) {
        this.log(`Task ${task.id} identified as shell command task.`, 'info');
        return await this.handleShellCommandTask(task);
      }

      this.log(
        `Task ${task.id} identified as general LLM task (code generation or other).`,
        'info'
      );

      return await this.handleLlmTask(task);
    } catch (error: any) {
      this.log(`Error executing task ${task.id}: ${error.message}`, 'error');

      return {
        success: false,
        message: error.message || 'Unknown error during task execution',
      };
    }
  }

  private async handleFileWriteTask(task: Task): Promise<TaskResult> {
    this.log(
      `Attempting LLM extraction for file write task ${task.id}`,
      'info'
    );

    const extractionPrompt = `Extract the file path and the full content to write from the following task description. \\nOutput ONLY a JSON object with two keys: "filePath" (string) and "content" (string).\\n\\nTask Description: "${task.description}"`;

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant extracting information.',
      },
      { role: 'user' as const, content: extractionPrompt },
    ];

    let filePath: string | undefined;
    let content: string | undefined;

    try {
      this.incrementLlmCalls();

      const llmResponse = await openaiTool.chatCompletion(messages, {
        openaiApiKey: this.config.openaiApiKey,
        openaiModel: this.config.openaiModel,
        temperature: 0.1,
      });

      if (llmResponse) {
        this.log(`LLM extraction response: ${llmResponse}`, 'info');

        try {
          const parsed = JSON.parse(llmResponse);

          if (
            typeof parsed.filePath === 'string' &&
            typeof parsed.content === 'string'
          ) {
            filePath = parsed.filePath;
            content = parsed.content;

            this.log(
              `LLM Extracted - Path: ${filePath}, Content Length: ${content?.length}`,
              'info'
            );
          } else {
            this.log(
              'LLM extraction JSON did not contain expected keys.',
              'warn'
            );
          }
        } catch (parseError: any) {
          this.log(
            `Failed to parse LLM response as JSON: ${parseError.message}`,
            'warn'
          );
        }
      } else {
        this.log('LLM did not return a response for file extraction.', 'warn');
      }
    } catch (error: any) {
      this.log(
        `LLM extraction failed for task ${task.id}: ${error.message}`,
        'error'
      );
    }

    if (filePath === undefined) {
      this.log(
        `LLM extraction failed for path, falling back to regex for task ${task.id}`,
        'warn'
      );

      const pathMatch = task.description.match(/(?:file|path)\\s+(\\S+)/i);
      filePath = path.resolve(
        this.config.workspaceDir || process.cwd(),
        pathMatch ? pathMatch[1] : `task_${task.id}_output.txt`
      );

      this.log(`Fallback path extracted: ${filePath}`, 'info');
    }

    if (content === undefined) {
      this.log(
        `LLM extraction failed for content, falling back to regex for task ${task.id}`,
        'warn'
      );

      const contentMatch = task.description.match(/content:(.*)/is);
      content = (contentMatch ? contentMatch[1].trim() : undefined) ?? '';

      if (!contentMatch) {
        this.log('Regex fallback also failed to extract content.', 'warn');
      }

      this.log(`Fallback content length: ${content.length}`, 'info');
    }

    const finalContent = content;
    const finalFilePath = filePath;

    if (!this.lockManager) {
      this.log(
        'LockManager not available, proceeding without file lock.',
        'warn'
      );

      await fileTool.writeFile(
        {
          filePath: finalFilePath,
          workspaceDir: this.config.workspaceDir,
          content: finalContent,
        },
        this.log
      );
    } else {
      try {
        await this.lockManager.acquireLock(finalFilePath);
        this.log(`Lock acquired for ${finalFilePath}. Writing file...`, 'info');

        await fileTool.writeFile(
          {
            filePath: finalFilePath,
            workspaceDir: this.config.workspaceDir,
            content: finalContent,
          },
          this.log
        );
      } finally {
        this.log(`Releasing lock for ${finalFilePath}...`, 'info');
        await this.lockManager.releaseLock(finalFilePath);
      }
    }

    return {
      success: true,
      message: `File ${finalFilePath} written.`,
      artifacts: [finalFilePath],
    };
  }

  private async handleShellCommandTask(task: Task): Promise<TaskResult> {
    this.log(
      `Attempting LLM extraction for shell command task ${task.id}`,
      'info'
    );

    const extractionPrompt = `Extract the exact shell command to execute from the following task description. \\nOutput ONLY a JSON object with a single key: "command" (string).\\n\\nTask Description: "${task.description}"`;

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful assistant extracting information.',
      },
      { role: 'user' as const, content: extractionPrompt },
    ];

    let command: string | undefined;

    try {
      this.incrementLlmCalls();

      const llmResponse = await openaiTool.chatCompletion(messages, {
        openaiApiKey: this.config.openaiApiKey,
        openaiModel: this.config.openaiModel,
        temperature: 0.1,
      });

      if (llmResponse) {
        this.log(`LLM extraction response: ${llmResponse}`, 'info');

        try {
          const parsed = JSON.parse(llmResponse);

          if (typeof parsed.command === 'string') {
            command = parsed.command;
            this.log(`LLM Extracted Command: ${command}`, 'info');
          } else {
            this.log(
              'LLM extraction JSON did not contain expected key "command".',
              'warn'
            );
          }
        } catch (parseError: any) {
          this.log(
            `Failed to parse LLM response as JSON: ${parseError.message}`,
            'warn'
          );
        }
      } else {
        this.log(
          'LLM did not return a response for command extraction.',
          'warn'
        );
      }
    } catch (error: any) {
      this.log(
        `LLM extraction failed for task ${task.id}: ${error.message}`,
        'error'
      );
    }

    if (command === undefined) {
      this.log(
        `LLM extraction failed, falling back to regex for task ${task.id}`,
        'warn'
      );

      const commandMatch = task.description.match(
        /(?:command:|execute:)\\s*(.*)/i
      );
      command = commandMatch ? commandMatch[1].trim() : undefined;

      if (command) {
        this.log(`Fallback command extracted: ${command}`, 'info');
      }
    }

    if (command === undefined || command.trim() === '') {
      this.log(
        `Could not determine command to run for task ${task.id}`,
        'error'
      );

      return { success: false, message: 'Could not determine command to run.' };
    }

    const cwd = this.config.workspaceDir || process.cwd();
    this.log(`Executing command: ${command} in ${cwd}`, 'info');
    const result = await shellTool.runCommand({ command, cwd }, this.log);

    this.log(
      `Shell command result - Code: ${result.code}, Stdout: ${result.stdout.substring(0, 100)}..., Stderr: ${result.stderr.substring(0, 100)}...`,
      'info'
    );

    return {
      success: result.code === 0,
      message:
        result.code === 0
          ? 'Command executed.'
          : `Command failed (code ${result.code})`,
      output: `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
      artifacts: [],
    };
  }

  private async handleEditFileTask(task: Task): Promise<TaskResult> {
    this.log(`Handling file edit task ${task.id} (Not Implemented)`, 'warn');
    // TODO: Implement LLM call to extract file path and edit instructions
    // TODO: Call fileTool.editFile (which also needs implementation)

    return { success: false, message: 'File editing not yet implemented.' };
  }

  private async handleLlmTask(task: Task): Promise<TaskResult> {
    this.log(`Handling task ${task.id} with LLM...`, 'info');

    const context = await this.gatherContext(task);

    const systemPrompt = `You are an expert coding assistant. \nGiven the task description and context, provide the necessary code or explanation. \nOutput ONLY the code required for the task, preferably within markdown code blocks (e.g., \`\`\`typescript ... \`\`\`). \nIf the task requires creating or modifying a specific file, mention the filename in the format 'FILE: path/to/filename.ext' on its own line right before the corresponding code block.`;

    const userPrompt = `Task: ${task.description}\n\n${context ? `Context:\n${context}\n\n` : ''}Response:`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    this.incrementLlmCalls();
    const llmResponse = await openaiTool.chatCompletion(messages, {
      openaiApiKey: this.config.openaiApiKey,
      openaiModel: this.config.openaiModel,
      temperature: this.config.temperature ?? 0.3,
    });

    if (!llmResponse) {
      this.log('LLM returned no response for task.', 'warn');
      return { success: false, message: 'LLM returned no response.' };
    }

    this.log(
      `LLM Response for task ${task.id}: ${llmResponse.substring(0, 200)}...`,
      'info'
    );

    const fileCodeBlocks = this.parseLlmResponse(llmResponse);
    const artifacts: string[] = [];
    let overallMessage = 'LLM task processed.';
    let operationOccurred = false;

    if (fileCodeBlocks.length > 0) {
      overallMessage = 'Code generated and files processed.';
      operationOccurred = true;

      for (const block of fileCodeBlocks) {
        const resolvedFilePath = path.resolve(
          this.config.workspaceDir || process.cwd(),
          block.filePath
        );

        this.log(
          `Processing extracted code for ${resolvedFilePath}...`,
          'info'
        );

        try {
          if (this.lockManager) {
            this.log(`Acquiring lock for ${resolvedFilePath}...`, 'info');
            await this.lockManager.acquireLock(resolvedFilePath);

            this.log(
              `Lock acquired for ${resolvedFilePath}. Writing file...`,
              'info'
            );
          }

          await fileTool.writeFile(
            {
              filePath: resolvedFilePath,
              workspaceDir: this.config.workspaceDir,
              content: block.code,
            },
            this.log
          );

          artifacts.push(resolvedFilePath);
        } catch (err: any) {
          this.log(
            `Failed to write file ${resolvedFilePath}: ${err.message}`,
            'error'
          );

          return {
            success: false,
            message: `Failed to write file ${resolvedFilePath}: ${err.message}`,
            artifacts,
          };
        } finally {
          if (this.lockManager) {
            this.log(`Releasing lock for ${resolvedFilePath}...`, 'info');
            await this.lockManager.releaseLock(resolvedFilePath);
          }
        }
      }
    } else {
      const fallbackCodeMatch = llmResponse.match(
        /```(?:\\w*\\n)?([\\s\\S]*?)```/
      );

      if (fallbackCodeMatch) {
        overallMessage =
          'LLM generated code, but no filename specified. Outputting to default file.';
        operationOccurred = true;

        const inferredName = task.description.match(
          /\\S+\\.(ts|js|py|html|css|md|json|txt)/i
        );

        const defaultFileName = inferredName
          ? inferredName[0]
          : `task_${task.id}_output.txt`;

        const resolvedFilePath = path.resolve(
          this.config.workspaceDir || process.cwd(),
          defaultFileName
        );

        this.log(`Writing code to default file: ${resolvedFilePath}`, 'warn');
        const code = fallbackCodeMatch[1].trim();

        try {
          if (this.lockManager) {
            this.log(`Acquiring lock for ${resolvedFilePath}...`, 'info');
            await this.lockManager.acquireLock(resolvedFilePath);
            this.log(
              `Lock acquired for ${resolvedFilePath}. Writing file...`,
              'info'
            );
          }

          await fileTool.writeFile(
            {
              filePath: resolvedFilePath,
              workspaceDir: this.config.workspaceDir,
              content: code,
            },
            this.log
          );

          artifacts.push(resolvedFilePath);
        } catch (err: any) {
          this.log(
            `Failed to write default file ${resolvedFilePath}: ${err.message}`,
            'error'
          );

          return {
            success: false,
            message: `Failed to write default file ${resolvedFilePath}: ${err.message}`,
            artifacts,
          };
        } finally {
          if (this.lockManager) {
            this.log(`Releasing lock for ${resolvedFilePath}...`, 'info');
            await this.lockManager.releaseLock(resolvedFilePath);
          }
        }
      } else {
        overallMessage =
          'LLM provided a textual response (no code block found).';
        this.log(overallMessage, 'info');

        return { success: true, message: overallMessage, output: llmResponse };
      }
    }

    return {
      success: operationOccurred,
      message: overallMessage,
      artifacts,
      output: llmResponse,
    };
  }

  private async gatherContext(task: Task): Promise<string> {
    let context = '';
    const potentialFiles = [
      ...new Set(task.description.match(/[\\/\\w\\.-]+\\.[a-zA-Z]+/g) || []),
    ];
    let filesRead = 0;

    for (const file of potentialFiles) {
      if (filesRead >= this.MAX_CONTEXT_FILES) {
        this.log('Reached max context files limit.', 'warn');
        break;
      }

      const filePath = path.resolve(
        this.config.workspaceDir || process.cwd(),
        file
      );

      try {
        if (
          await fileTool.fileExists({
            filePath: filePath,
            workspaceDir: this.config.workspaceDir,
          })
        ) {
          this.log(`Reading context from file: ${filePath}`, 'info');

          const fileContent = await fileTool.readFile(
            {
              filePath: filePath,
              workspaceDir: this.config.workspaceDir,
            },
            this.log
          );

          context += `\n--- Content of ${file} ---\n${fileContent.substring(0, this.MAX_FILE_CONTEXT_LENGTH)}${fileContent.length > this.MAX_FILE_CONTEXT_LENGTH ? '... (truncated)' : ''}
--- End of ${file} ---\n`;
          filesRead++;
        } else {
          this.log(`Potential context file not found: ${filePath}`, 'info');
        }
      } catch (err: any) {
        this.log(
          `Could not read potential context file ${filePath}: ${err.message}`,
          'warn'
        );
      }
    }

    return context;
  }

  private parseLlmResponse(
    response: string
  ): { filePath: string; code: string }[] {
    const blocks: { filePath: string; code: string }[] = [];
    const fileBlockRegex =
      /^FILE:\\s*(\\S+)\\s*\\n```(?:\\w*\\n)?([\\s\\S]*?)```/gm;
    let match;

    while ((match = fileBlockRegex.exec(response)) !== null) {
      const filePath = match[1].trim();
      const code = match[2].trim();

      if (filePath && code) {
        blocks.push({ filePath, code });
      }
    }

    return blocks;
  }
}
