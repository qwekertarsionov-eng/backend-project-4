#!/usr/bin/env node

import { Command } from 'commander';
import pageLoader from '../src/index.js';

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility with robust error handling')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    pageLoader(url, options.output)
      .then((savedPath) => {
        console.log(`Page was successfully downloaded into ${savedPath}`);
      })
      .catch((error) => {
        // 1. Обработка ошибок файловой системы (FS errors)
        if (error.code === 'ENOENT') {
          console.error(`Error: Directory or file not found. Please check your output path: "${options.output}"`);
        } else if (error.code === 'EACCES') {
          console.error(`Error: Permission denied. You do not have write access to "${options.output}"`);
        }
        // 2. Обработка сетевых ошибок (Axios / Network errors)
        else if (error.isAxiosError) {
          const targetUrl = error.config ? error.config.url : url;

          if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
            console.error(`Error: Network connection failed for "${targetUrl}". Please check your internet connection.`);
          } else if (error.response) {
            console.error(`Error: Server responded with status code ${error.response.status} for resource "${targetUrl}"`);
          } else {
            console.error(`Error: Failed to fetch resource "${targetUrl}" (${error.message})`);
          }
        }
        // 3. Непредвиденные системные ошибки
        else {
          console.error(`An unexpected error occurred: ${error.message}`);
        }

        // Обязательно возвращаем ненулевой код завершения утилиты
        process.exit(1);
      });
  });

program.parse(process.argv);
