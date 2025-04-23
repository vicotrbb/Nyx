import * as fileTool from './fileTool';
import * as shellTool from './shellTool';
import * as browserTools from './browserTools';
import { LoggerFunc } from '../agents/workerAgent';
import { defaultLogger } from '../../utils/logger';

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

type ToolFunction = (...args: unknown[]) => Promise<unknown>;

export class ToolDispatcher {
  private toolMap: Map<string, ToolFunction> = new Map();
  private log: LoggerFunc;

  constructor(logger: LoggerFunc = defaultLogger) {
    this.log = logger;
    this.discoverTools();
  }

  private discoverTools() {
    this.log('Discovering tools...', 'info');

    const toolModules = [
      { name: 'fileTool', module: fileTool },
      { name: 'shellTool', module: shellTool },
      { name: 'browserTool', module: browserTools },
    ];

    for (const { module } of toolModules) {
      for (const key in module) {
        if (typeof (module as any)[key] === 'function') {
          const func = (module as any)[key] as ToolFunction;
          const snakeCaseName = toSnakeCase(key);

          this.log(`Mapping tool: ${key} -> ${snakeCaseName}`, 'info');
          this.toolMap.set(snakeCaseName, func);
        }
      }
    }

    this.log(`Discovered ${this.toolMap.size} tools.`, 'info');
  }

  async dispatch(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    this.log(`Dispatching tool: ${toolName}`, 'info');
    const toolFunction = this.toolMap.get(toolName);

    if (!toolFunction) {
      this.log(`Tool not found: ${toolName}`, 'error');
      throw new Error(`Tool "${toolName}" not found.`);
    }

    try {
      this.log(`Executing ${toolName} with args object...`, 'info');
      const result = await toolFunction(args);
      this.log(`Tool ${toolName} executed successfully.`, 'info');

      return result;
    } catch (error: any) {
      this.log(`Error executing tool ${toolName}: ${error.message}`, 'error');

      if (
        error instanceof TypeError &&
        (error.message.includes('undefined') ||
          error.message.includes('called on null'))
      ) {
        throw new Error(
          `Failed to execute tool "${toolName}". Argument mismatch likely. Provided args: ${JSON.stringify(args)}. Error: ${error.message}`
        );
      }

      throw new Error(`Failed to execute tool "${toolName}": ${error.message}`);
    }
  }
}
