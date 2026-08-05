import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Превращает URL в базовую строку-имя (без расширения)
const convertUrlToSlug = (urlStr) => {
  const url = new URL(urlStr);
  const combined = `${url.host}${url.pathname}`;
  const clean = combined.endsWith('/') ? combined.slice(0, -1) : combined;
  return clean.replace(/[^a-zA-Z0-9]/g, '-');
};

const pageLoader = (pageUrl, outputDir = process.cwd()) => {
  const baseSlug = convertUrlToSlug(pageUrl);
  const mainHtmlFilename = `${baseSlug}.html`;
  const assetsDirname = `${baseSlug}_files`;

  const mainHtmlPath = path.join(outputDir, mainHtmlFilename);
  const assetsDirPath = path.join(outputDir, assetsDirname);

  const originUrl = new URL(pageUrl);
  let assetsToDownload = []; // Массив объектов { downloadUrl, savePath }

  return axios.get(pageUrl)
    .then((response) => {
      const $ = cheerio.load(response.data);

      // Ищем все теги img
      $('img').each((_, element) => {
        const src = $(element).attr('src');
        if (!src) return;

        // Строим полный URL для скачивания (поддерживает как абсолютные, так и относительные пути)
        const assetUrl = new URL(src, originUrl.origin);

        // Скачиваем только ресурсы с того же домена, что и страница
        if (assetUrl.origin === originUrl.origin) {
          const extension = path.extname(assetUrl.pathname) || '.png';
          // Убираем расширение из пути для формирования имени
          const pathWithoutExt = assetUrl.pathname.substring(0, assetUrl.pathname.length - extension.length);
          const assetSlug = `${assetUrl.host}${pathWithoutExt}`.replace(/[^a-zA-Z0-9]/g, '-');
          const assetFilename = `${assetSlug}${extension}`;

          const localPathForHtml = path.join(assetsDirname, assetFilename);
          const absoluteSavePath = path.join(assetsDirPath, assetFilename);

          // Меняем ссылку внутри HTML
          $(element).attr('src', localPathForHtml);

          // Добавляем в очередь на скачивание
          assetsToDownload.push({
            downloadUrl: assetUrl.toString(),
            savePath: absoluteSavePath,
          });
        }
      });

      // Передаем измененный html-код и очередь дальше по цепочке
      return $.html();
    })
    .then((modifiedHtml) => {
      // Создаем директорию для ресурсов, если в очереди что-то есть
      if (assetsToDownload.length === 0) {
        return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8');
      }

      return fs.mkdir(assetsDirPath, { recursive: true })
        .then(() => {
          // Скачиваем все ресурсы параллельно через Promise.all
          const promises = assetsToDownload.map((asset) => {
            return axios.get(asset.downloadUrl, { responseType: 'arraybuffer' })
              .then((res) => fs.writeFile(asset.savePath, res.data));
          });
          return Promise.all(promises);
        })
        .then(() => fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8'));
    })
    .then(() => mainHtmlPath); // Возвращаем путь к главному файлу
};

export default pageLoader;
