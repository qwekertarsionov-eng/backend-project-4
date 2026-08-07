import { test, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import nock from 'nock';
import pageLoader from '../src/index.js';

nock.disableNetConnect();

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download html and all local assets matching assignment fixtures', async () => {
  const baseUrl = 'https://ru.hexlet.io';
  const pageUrl = `${baseUrl}/courses`;

  const htmlBefore = await fs.readFile(path.resolve('__fixtures__', 'before.html'), 'utf-8');
  const htmlAfter = await fs.readFile(path.resolve('__fixtures__', 'after.html'), 'utf-8');

  // Перехватываем только реальные локальные файлы
  nock(baseUrl).get('/courses').reply(200, htmlBefore);
  nock(baseUrl).get('/assets/application.css').reply(200, 'css-content');
  nock(baseUrl).get('/assets/professions/nodejs.png').reply(200, 'png-content');
  nock(baseUrl).get('/packs/js/runtime.js').reply(200, 'js-content');

  const resultHtmlPath = await pageLoader(pageUrl, tempDir);

  // 1. Проверяем путь сохранённого HTML
  expect(resultHtmlPath).toBe(path.join(tempDir, 'ru-hexlet-io-courses.html'));

  // 2. Сравниваем контент страницы без учёта лишних пробелов cheerio
  const savedHtml = await fs.readFile(resultHtmlPath, 'utf-8');
  expect(savedHtml.replace(/\s+/g, '')).toBe(htmlAfter.replace(/\s+/g, ''));

  // 3. Убеждаемся, что локальные файлы ресурсов созданы на диске
  const filesDir = path.join(tempDir, 'ru-hexlet-io-courses_files');
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-assets-application.css'))).resolves.not.toThrow();
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-assets-professions-nodejs.png'))).resolves.not.toThrow();
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-packs-js-runtime.js'))).resolves.not.toThrow();
});
