#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    console.log(`URL to download: ${url}`);
    console.log(`Output directory: ${options.output}`);
  });

program.parse(process.argv);