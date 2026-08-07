#!/usr/bin/env node

import { Command } from 'commander';
import { Listr } from 'listr2';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { extractAssets } from '../src/index.js';


const convertUrlToSlug = (urlStr) => {
  const urlWithoutProtocol = urlStr.replace(/^https?:\/\//, '');
  const cleanStr = urlWithoutProtocol.endsWith('/') ? urlWithoutProtocol.slice(0, -1) : urlWithoutProtocol;
  return cleanStr.replace(/[^a-zA-Z0-9]/g, '-');
};

const program = new Command();

program
  .version('1.0.0')
  .description('Page loader utility with progress bar')
  .arguments('<url>')
  .option('-o, --output [dir]', 'output directory', process.cwd())
  .action((url, options) => {
    const outputDir = options.output;
    const baseSlug = convertUrlToSlug(url);
    const mainHtmlPath = path.join(outputDir, `${baseSlug}.html`);
    const assetsDirname = `${baseSlug}_files`;
    const assetsDirPath = path.join(outputDir, assetsDirname);

    let htmlData = '';
    let modifiedHtml = '';
    let assets = [];

    // Создаем менеджер задач Listr
    const tasks = new Listr([
      {
        title: `Fetching main page: ${url}`,
        task: () => {
          return axios.get(url).then((response) => {
            htmlData = response.data;
          });
        },
      },
      {
        title: 'Parsing page assets and links',
        task: () => {
          const result = extractAssets(htmlData, url, assetsDirname, assetsDirPath);
          modifiedHtml = result.modifiedHtml;
          assets = result.assets;
        },
      },
      {
        title: 'Downloading local resources',
        skip: () => assets.length === 0 ? 'No local assets found.' : false,
        task: (ctx, task) => {
          // Создаем директорию для ресурсов
          return fs.mkdir(assetsDirPath, { recursive: true }).then(() => {
            // Генерируем массив параллельных подзадач
            return task.newListr(
              assets.map((asset) => ({
                title: `Downloading ${asset.filename}`,
                task: () => {
                  return axios.get(asset.url, { responseType: 'arraybuffer' })
                    .then((res) => fs.writeFile(asset.savePath, res.data));
                },
              })),
              { concurrent: true, exitOnError: true } // Флаг ОДНОВРЕМЕННОЙ параллельной загрузки
            );
          });
        },
      },
      {
        title: `Saving final HTML page to ${mainHtmlPath}`,
        task: () => {
          return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8');
        },
      },
    ]);

    tasks.run()
      .then(() => {
        console.log(`\nSuccess: Page was successfully downloaded into ${mainHtmlPath}`);
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
