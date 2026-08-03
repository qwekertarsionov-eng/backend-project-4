import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

// Вспомогательная функция для генерации имени файла (чистая синхронная логика)
const buildFilenameFromUrl = (urlStr) => {
  const url = new URL(urlStr);
  const combinedPath = `${url.host}${url.pathname}`;
  
  // Очищаем слэш на конце, если он есть
  const cleanPath = combinedPath.endsWith('/') ? combinedPath.slice(0, -1) : combinedPath;
  
  // Заменяем всё, кроме букв и цифр, на дефисы
  const baseName = cleanPath.replace(/[^a-zA-Z0-9]/g, '-');
  return `${baseName}.html`;
};

const pageLoader = (url, outputDir = process.cwd()) => {
  const filename = buildFilenameFromUrl(url);
  const fullPath = path.join(outputDir, filename);

  // Строим асинхронную цепочку исключительно на промисах
  return axios.get(url)
    .then((response) => {
      // Записываем файл асинхронно
      return fs.writeFile(fullPath, response.data, 'utf-8');
    })
    .then(() => {
      // Возвращаем полный путь к файлу, как требует задача
      return fullPath;
    });
};

export default pageLoader;