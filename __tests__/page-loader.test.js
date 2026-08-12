import { test, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import nock from 'nock';
import pageLoader from '../index.js';

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

  nock(baseUrl).get('/courses').reply(200, htmlBefore);
  nock(baseUrl).get('/assets/application.css').reply(200, 'css-content');
  nock(baseUrl).get('/assets/professions/nodejs.png').reply(200, 'png-content');
  nock(baseUrl).get('/packs/js/runtime.js').reply(200, 'js-content');

  const resultHtmlPath = await pageLoader(pageUrl, tempDir);

  // 1. Проверяем путь сохранённого HTML
  expect(resultHtmlPath).toBe(path.join(tempDir, 'ru-hexlet-io-courses.html'));

  // 2. Сравниваем контент страницы
  const savedHtml = await fs.readFile(resultHtmlPath, 'utf-8');
  expect(savedHtml.replace(/\s+/g, '')).toBe(htmlAfter.replace(/\s+/g, ''));

  // 3. Убеждаемся, что локальные файлы ресурсов созданы на диске
  const filesDir = path.join(tempDir, 'ru-hexlet-io-courses_files');
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-assets-application.css'))).resolves.not.toThrow();
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-assets-professions-nodejs.png'))).resolves.not.toThrow();
  await expect(fs.access(path.join(filesDir, 'ru-hexlet-io-packs-js-runtime.js'))).resolves.not.toThrow();
});

test('should throw error when main page returns 404', async () => {
  nock('https://ru.hexlet.io') // мок для ru.hexlet.io
    .get('/invalid-page')
    .reply(404);

  // ОШИБКА БЫЛА ТУТ: передавался адрес без "ru."
  await expect(pageLoader('https://hexlet.io', tempDir)).rejects.toThrow();
});


// Теперь мы ожидаем, что падение ассета НЕ ломает загрузку всей страницы!
test('should handle gracefully when asset returns 500', async () => {
  const htmlBefore = '<img src="/assets/professions/nodejs.png" />';

  nock('https://ru.hexlet.io').get('/courses').reply(200, htmlBefore);
  nock('https://ru.hexlet.io').get('/assets/professions/nodejs.png').reply(500);

  // Программа должна завершиться успешно (resolves), а не упасть (rejects)
  await expect(pageLoader('https://ru.hexlet.io/courses', tempDir)).resolves.not.toThrow();
});

test('should throw error when permission denied', async () => {
  nock('https://ru.hexlet.io').get('/courses').reply(200, '<html></html>');

  // Ошибка записи в системную закрытую директорию /root по-прежнему должна выбрасываться
  await expect(pageLoader('https://ru.hexlet.io/courses', '/root')).rejects.toThrow();
});
