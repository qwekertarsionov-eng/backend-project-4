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

test('download html and its assets (images)', async () => {
  const baseUrl = 'https://ru.hexlet.io';
  const pageUrl = `${baseUrl}/courses`;

  // Загружаем контент фикстур
  const htmlBefore = await fs.readFile(path.resolve('__fixtures__', 'before.html'), 'utf-8');
  const htmlAfter = await fs.readFile(path.resolve('__fixtures__', 'after.html'), 'utf-8');
  const imgFixture = await fs.readFile(path.resolve('__fixtures__', 'nodejs.png'));

  // Имитируем запросы к сети
  nock(baseUrl)
    .get('/courses')
    .reply(200, htmlBefore);

  nock(baseUrl)
    .get('/assets/professions/nodejs.png')
    .reply(200, imgFixture, { 'content-type': 'image/png' });

  // Запускаем
  const resultHtmlPath = await pageLoader(pageUrl, tempDir);

  // 1. Проверяем возвращаемый путь к HTML-файлу
  expect(resultHtmlPath).toBe(path.join(tempDir, 'ru-hexlet-io-courses.html'));

  // 2. Проверяем, что измененный HTML соответствует ожиданиям
  const savedHtml = await fs.readFile(resultHtmlPath, 'utf-8');
  // Используем регулярное выражение или cheerio.load, так как cheerio может менять форматирование
  expect(savedHtml.replace(/\s+/g, '')).toBe(htmlAfter.replace(/\s+/g, ''));

  // 3. Проверяем, что картинка скачалась в правильную папку
  const expectedImgPath = path.join(
    tempDir,
    'ru-hexlet-io-courses_files',
    'ru-hexlet-io-assets-professions-nodejs.png'
  );
  const savedImg = await fs.readFile(expectedImgPath);
  expect(savedImg).toEqual(imgFixture);
});
