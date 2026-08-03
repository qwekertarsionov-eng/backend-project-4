#!/usr/bin/env node

import { Command } from 'commander';
import pageLoader from '../src/index.js';

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    pageLoader(url, options.output)
      .then((savedPath) => {
        console.log(savedPath); // Программа должна возвращать полный путь в консоль
      })
      .catch((error) => {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      });
  });

program.parse(process.argv);