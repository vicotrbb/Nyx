/**
 * Placeholder for the NyxConfig interface.
 * Defines the structure for configuration settings.
 */
export interface NyxConfig {
  openaiApiKey: string;
  openaiModel: string;
  planningModel: string;
  maxTokens?: number;
  temperature?: number;
  workspaceDir?: string;
  useDashboard?: boolean;
  planOnly?: boolean;
  autoConfirm?: boolean;
}

interface CLIOptions {
  model?: string;
  planningModel?: string;
  noDashboard?: boolean;
  planOnly?: boolean;
  autoConfirm?: boolean;
}

/**
 * Loads the configuration for Nyx, merging environment variables,
 * default values, and CLI options.
 * @param {CLIOptions} cliOptions Options parsed from the command line.
 * @returns {NyxConfig} The resolved configuration object.
 * @throws {Error} If required configuration (like API key) is missing.
 */
export function loadConfig(cliOptions: CLIOptions = {}): NyxConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY not found. Please set it in your environment or a .env file.'
    );
  }

  const defaults: Partial<NyxConfig> = {
    openaiModel: 'gpt-4',
    planningModel: 'gpt-4',
    temperature: 0.2,
    maxTokens: 4096,
    workspaceDir: process.cwd(),
    useDashboard: true,
    planOnly: false,
    autoConfirm: false,
  };

  const config: NyxConfig = {
    ...defaults,
    openaiApiKey: apiKey,
    openaiModel:
      process.env.OPENAI_MODEL || cliOptions.model || defaults.openaiModel!,
    planningModel:
      process.env.PLANNING_MODEL ||
      cliOptions.planningModel ||
      defaults.planningModel!,
    useDashboard: !(cliOptions.noDashboard ?? !defaults.useDashboard),
    planOnly: cliOptions.planOnly ?? defaults.planOnly,
    autoConfirm: cliOptions.autoConfirm ?? defaults.autoConfirm,
    workspaceDir: process.env.NYX_WORKSPACE_DIR || defaults.workspaceDir,
  };

  return config;
}
