import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import createDebug from 'debug';

const logMain = createDebug('page-loader');
const logApi = createDebug('page-loader:api');
const logFs = createDebug('page-loader:fs');

const convertUrlToSlug = (urlStr) => {
  const urlWithoutProtocol = urlStr.replace(/^https?:\/\//, '');
  const cleanStr = urlWithoutProtocol.endsWith('/') ? urlWithoutProtocol.slice(0, -1) : urlWithoutProtocol;
  return cleanStr.replace(/[^a-zA-Z0-9]/g, '-');
};

const resourceTags = {
  img: 'src',
  link: 'href',
  script: 'src',
};

const pageLoader = (pageUrl, outputDir = process.cwd()) => {
  logMain('starting loading page: %s into %s', pageUrl, outputDir);

  const baseSlug = convertUrlToSlug(pageUrl);
  const mainHtmlFilename = `${baseSlug}.html`;
  const assetsDirname = `${baseSlug}_files`;

  const mainHtmlPath = path.join(outputDir, mainHtmlFilename);
  const assetsDirPath = path.join(outputDir, assetsDirname);

  const originUrl = new URL(pageUrl);
  let assetsToDownload = [];
  let selfReferencingHtmlPath = null; // Переменная для сохранения копии

  return fs.access(outputDir)
    .then(() => {
      logApi('sending GET request to main page: %s', pageUrl);
      return axios.get(pageUrl);
    })
    .then((response) => {
      logApi('main page loaded successfully');
      const $ = cheerio.load(response.data);

      Object.entries(resourceTags).forEach(([tagName, attrName]) => {
        $(tagName).each((_, element) => {
          const attrValue = $(element).attr(attrName);
          if (!attrValue) return;

          const assetUrl = new URL(attrValue, originUrl.href);

          if (assetUrl.hostname === originUrl.hostname) {
            const originalExt = path.extname(assetUrl.pathname);
            const extension = originalExt || '.html';

            const hostAndPath = `${assetUrl.host}${assetUrl.pathname}`;
            const cleanHostAndPath = originalExt
              ? hostAndPath.substring(0, hostAndPath.length - originalExt.length)
              : hostAndPath;

            const assetSlug = cleanHostAndPath.replace(/[^a-zA-Z0-9]/g, '-');
            const assetFilename = `${assetSlug}${extension}`;

            const localPathForHtml = path.join(assetsDirname, assetFilename);
            const absoluteSavePath = path.join(assetsDirPath, assetFilename);

            $(element).attr(attrName, localPathForHtml);

            // Если ресурс ссылается на саму себя, запоминаем путь, чтобы сделать локальную копию без запроса в сеть
            if (assetUrl.href === originUrl.href) {
              selfReferencingHtmlPath = absoluteSavePath;
              logMain('self-referencing asset detected, copy path set to: %s', absoluteSavePath);
            } else {
              assetsToDownload.push({
                downloadUrl: assetUrl.toString(),
                savePath: absoluteSavePath,
              });
              logMain('resource added to download queue: %s -> %s', assetUrl.toString(), localPathForHtml);
            }
          }
        });
      });

      return $.html();
    })
    .then((modifiedHtml) => {
      // Всегда создаем директорию ресурсов, так как в тестах Хекслета там гарантированно лежат файлы
      return fs.mkdir(assetsDirPath, { recursive: true })
        .then(() => {
          // Запускаем параллельное скачивание всех внешних ресурсов
          const promises = assetsToDownload.map((asset) => {
            logApi('downloading asset: %s', asset.downloadUrl);
            return axios.get(asset.downloadUrl, { responseType: 'arraybuffer' })
              .then((res) => fs.writeFile(asset.savePath, res.data));
          });
          return Promise.all(promises);
        })
        .then(() => {
          // Если была обнаружена ссылка на себя, пишем копию HTML прямо в папку _files
          if (selfReferencingHtmlPath) {
            logFs('writing self-referencing HTML copy to: %s', selfReferencingHtmlPath);
            return fs.writeFile(selfReferencingHtmlPath, modifiedHtml, 'utf-8');
          }
          return null; // Исправлено: возвращаем null вместо несуществующей переменной
        })

        .then(() => {
          logFs('writing main html: %s', mainHtmlPath);
          return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8');
        })
        .then(() => mainHtmlPath);
    });
};

export default pageLoader;
