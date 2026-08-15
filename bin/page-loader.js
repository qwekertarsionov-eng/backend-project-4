#!/usr/bin/env node

import { Command } from 'commander';
import pageLoader from '../index.js';

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    const outputDir = options.output || process.cwd();

    pageLoader(url, outputDir)
      .then((savedPath) => {
        if (savedPath) {
          console.log(`Success: Page was successfully downloaded into ${savedPath}`);
        }
      })
      // ИСПРАВЛЕНО: Перехватываем проброшенную ошибку ядра и корректно выходим из CLI
      .catch(() => {
        process.exit(1);
      });
  });

program.parse(process.argv);
