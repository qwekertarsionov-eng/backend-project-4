import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import createDebug from 'debug';

const logMain = createDebug('page-loader');
const logApi = createDebug('page-loader:api');
const logFs = createDebug('page-loader:fs');

const convertUrlToSlug = (urlStr) => {
  const url = new URL(urlStr);
  const hostPathAndQuery = `${url.host}${url.pathname}${url.search}`;
  const cleanStr = hostPathAndQuery.endsWith('/') ? hostPathAndQuery.slice(0, -1) : hostPathAndQuery;
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

  return fs.mkdir(outputDir, { recursive: true })
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
          // Находим строку, где определяется расширение (примерно 53-54 строка)
            const originalExt = path.extname(assetUrl.pathname);

            // ИСПРАВЛЕНО ДЛЯ ТЕСТА: Если расширения нет, по умолчанию ставим '.html' (для страниц)
            const extension = originalExt || '.html';

            const pathSegments = assetUrl.pathname.split('/').filter(Boolean);
            const hostAndPath = path.join(assetUrl.host, ...pathSegments);
            const hostPathAndQuery = `${hostAndPath}${assetUrl.search}`;

            // Если оригинальное расширение было, отрезаем его длину, если не было (добавили .html) — строку не трогаем
            const cleanHostAndPath = originalExt
              ? hostPathAndQuery.substring(0, hostPathAndQuery.length - originalExt.length)
              : hostPathAndQuery;

            const assetSlug = cleanHostAndPath.replace(/[^a-zA-Z0-9]/g, '-');
            const assetFilename = `${assetSlug}${extension}`;


            const localPathForHtml = path.join(assetsDirname, assetFilename);
            const absoluteSavePath = path.join(assetsDirPath, assetFilename);

            assetsToDownload.push({
              downloadUrl: assetUrl.toString(),
              savePath: absoluteSavePath,
            });
            $(element).attr(attrName, localPathForHtml);
            logMain('resource processed: %s -> %s', assetUrl.toString(), localPathForHtml);
          }
        });
      });
      return $.html();
    })
    .then((modifiedHtml) => {
      if (assetsToDownload.length === 0) {
        logFs('writing main html: %s', mainHtmlPath);
        return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8').then(() => mainHtmlPath);
      }
      logFs('creating directory for assets: %s', assetsDirPath);
      return fs.mkdir(assetsDirPath, { recursive: true })
        .then(() => {
          const promises = assetsToDownload.map((asset) => {
            logApi('downloading asset: %s', asset.downloadUrl);
            return axios.get(asset.downloadUrl, { responseType: 'arraybuffer' })
              .then((res) => fs.writeFile(asset.savePath, res.data))
              // Перехватываем ошибку каждого конкретного файла индивидуально
              .catch((assetError) => {
                logApi('Warning: asset %s failed to download (%s)', asset.downloadUrl, assetError.message);
                return null; // Возвращаем пустой результат, чтобы Promise.all НЕ падал целиком
              });
          });
          return Promise.all(promises);
        })
        .then(() => {
          logFs('writing main html: %s', mainHtmlPath);
          return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8');
        })
        .then(() => mainHtmlPath);
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
      // выбрасываем ошибку дальше, чтобы её видел Jest
      throw error;
    });
};

export default pageLoader;
