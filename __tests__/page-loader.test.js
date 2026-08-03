import { test, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import nock from 'nock';
import pageLoader from '../src/index.js';

// Отключаем реальную сеть для тестов
nock.disableNetConnect();

let tempDir;

beforeEach(async () => {
  // Создаем изолированную временную директорию перед каждым тестом
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download base html page', async () => {
  const url = 'https://ru.hexlet.io/courses';
  
  // Контент фикстуры, который якобы вернет сеть
  const fixturePath = path.resolve(process.cwd(), '__fixtures__', 'before.html');
  const expectedContent = await fs.readFile(fixturePath, 'utf-8');

  // Мокаем сетевой запрос через nock
  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, expectedContent);

  // Вызываем функцию скачивания
  const resultFilePath = await pageLoader(url, tempDir);
  const expectedFileName = 'ru-hexlet-io-courses.html';

  // Проверяем, что утилита вернула полный путь к файлу
  expect(resultFilePath).toBe(path.join(tempDir, expectedFileName));

  // Проверяем, что контент записался корректно
  const savedContent = await fs.readFile(resultFilePath, 'utf-8');
  expect(savedContent).toBe(expectedContent);
});