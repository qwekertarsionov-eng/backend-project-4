#!/usr/bin/env node

import { Command } from 'commander';
import { Listr } from 'listr2';
import pageLoader from '../src/index.js';

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    const outputDir = options.output || process.cwd();

    // Запускаем красивый трекер Listr вокруг единой функции
    const tasks = new Listr([
      {
        title: `Downloading page and assets from ${url}`,
        task: () => pageLoader(url, outputDir),
      },
    ]);

    tasks.run()
      .then((savedPath) => {
        console.log(`Success: Page was successfully downloaded into ${savedPath}`);
      })
      .catch((error) => {
        if (error.code === 'ENOENT') {
          console.error(`Error: Directory not found: "${outputDir}"`);
        } else if (error.code === 'EACCES') {
          console.error(`Error: Permission denied for "${outputDir}"`);
        } else if (error.isAxiosError) {
          console.error(`Error: Network failed (${error.message})`);
        } else {
          console.error(`An unexpected error occurred: ${error.message}`);
        }
        process.exit(1);
      });
  });

program.parse(process.argv);

