import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import createDebug from 'debug';

const logMain = createDebug('page-loader');
const logApi = createDebug('page-loader:api');

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

// Экспортируем внутреннюю функцию парсинга ресурсов, чтобы CLI мог построить по ней Listr таски
export const extractAssets = (htmlContent, pageUrl, assetsDirname, assetsDirPath) => {
  const $ = cheerio.load(htmlContent);
  const originUrl = new URL(pageUrl);
  const assetsToDownload = [];

  Object.entries(resourceTags).forEach(([tagName, attrName]) => {
    $(tagName).each((_, element) => {
      const attrValue = $(element).attr(attrName);
      if (!attrValue) return;

      const assetUrl = new URL(attrValue, originUrl.href);

      if (assetUrl.hostname === originUrl.hostname) {
        if (assetUrl.pathname === originUrl.pathname && tagName === 'link' && $(element).attr('rel') === 'canonical') {
          const localPathForHtml = path.join(assetsDirname, `${convertUrlToSlug(pageUrl)}.html`);
          $(element).attr(attrName, localPathForHtml);
          return;
        }

        const extension = path.extname(assetUrl.pathname) || '.html';
        const hostAndPath = `${assetUrl.host}${assetUrl.pathname}`;
        const cleanHostAndPath = hostAndPath.endsWith(extension)
          ? hostAndPath.substring(0, hostAndPath.length - extension.length)
          : hostAndPath;

        const assetSlug = cleanHostAndPath.replace(/[^a-zA-Z0-9]/g, '-');
        const assetFilename = `${assetSlug}${extension}`;

        const localPathForHtml = path.join(assetsDirname, assetFilename);
        const absoluteSavePath = path.join(assetsDirPath, assetFilename);

        assetsToDownload.push({
          url: assetUrl.toString(),
          filename: assetFilename,
          savePath: absoluteSavePath,
        });

        $(element).attr(attrName, localPathForHtml);
      }
    });
  });

  return { modifiedHtml: $.html(), assets: assetsToDownload };
};

const pageLoader = (pageUrl, outputDir = process.cwd()) => {
  logMain('starting loading page: %s into %s', pageUrl, outputDir);

  const baseSlug = convertUrlToSlug(pageUrl);
  const mainHtmlFilename = `${baseSlug}.html`;
  const assetsDirname = `${baseSlug}_files`;

  const mainHtmlPath = path.join(outputDir, mainHtmlFilename);
  const assetsDirPath = path.join(outputDir, assetsDirname);

  logApi('sending GET request to main page: %s', pageUrl);
  return axios.get(pageUrl)
    .then((response) => {
      logApi('main page loaded successfully');
      const { modifiedHtml, assets } = extractAssets(response.data, pageUrl, assetsDirname, assetsDirPath);

      if (assets.length === 0) {
        return fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8').then(() => mainHtmlPath);
      }

      return fs.mkdir(assetsDirPath, { recursive: true })
        .then(() => {
          const promises = assets.map((asset) => {
            return axios.get(asset.url, { responseType: 'arraybuffer' })
              .then((res) => fs.writeFile(asset.savePath, res.data));
          });
          return Promise.all(promises);
        })
        .then(() => fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8'))
        .then(() => mainHtmlPath);
    });
};

export default pageLoader;
