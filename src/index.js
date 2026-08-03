import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const buildFilenameFromUrl = (urlStr) => {
  const url = new URL(urlStr);
  const combinedPath = `${url.host}${url.pathname}`;
  
  // Убираем слэш на конце, если путь пустой или заканчивается слэшем (например, 'hexlet.io/')
  const cleanPath = combinedPath.endsWith('/') ? combinedPath.slice(0, -1) : combinedPath;
  
  // Заменяем спецсимволы на один дефис
  return `${cleanPath.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
};

const pageLoader = async (url, outputDir = process.cwd()) => {
  const filename = buildFilenameFromUrl(url);
  const fullPath = path.join(outputDir, filename);

  const response = await axios.get(url);
  await fs.writeFile(fullPath, response.data, 'utf-8');

  return fullPath;
};

export default pageLoader;