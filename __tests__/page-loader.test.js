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

test('download base html page', async () => {
  // Тестируем именно тот URL, который запрашивает axios в логе
  const url = 'https://hexlet.io/';
  
  const fixturePath = path.resolve(process.cwd(), '__fixtures__', 'before.html');
  const expectedContent = await fs.readFile(fixturePath, 'utf-8');

  // Перехватываем запрос для https://hexlet.io/
  nock('https://hexlet.io')
    .get('/')
    .reply(200, expectedContent);

  // Перехватываем на всякий случай и субдомен ru.
  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, expectedContent);

  const resultFilePath = await pageLoader(url, tempDir);
  
  // Имя файла должно сгенерироваться на основе 'https://hexlet.io/' -> 'hexlet-io.html'
  const expectedFileName = 'hexlet-io.html';
  
  expect(resultFilePath).toBe(path.join(tempDir, expectedFileName));

  const savedContent = await fs.readFile(resultFilePath, 'utf-8');
  expect(savedContent).toBe(expectedContent);
});