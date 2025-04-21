#!/usr/bin/env node
/* eslint-disable no-console */
import 'dotenv/config';

import { Command } from 'commander';
import { Orchestrator } from '../core/orchestrator';
import { loadConfig } from '../config/nyxConfig';

async function main() {
  const program = new Command();
  program
    .name('nyx')
    .version('0.1.0')
    .description(
      'Nyx - an AI coding agent CLI that generates applications via dashboard input.'
    )
    .option('--no-dashboard', 'Disable interactive dashboard UI', false)
    .option('--model <name>', 'LLM model to use (e.g., gpt-4, gpt-3.5-turbo)')
    .option(
      '--planning-model <name>',
      'LLM model to use for planning (e.g., gpt-4, gpt-3.5-turbo)'
    )
    .allowUnknownOption()
    .parse(process.argv);

  const cliOptions = program.opts();

  try {
    const config = loadConfig(cliOptions);

    const orchestrator = Orchestrator.getInstance();
    orchestrator.initialize(config);
  } catch (error: any) {
    console.error('\nError during Nyx initialization:');
    console.error(error.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main execution:', err);
  process.exit(1);
});
