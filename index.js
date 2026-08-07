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

  logApi('sending GET request to main page: %s', pageUrl);
  return axios.get(pageUrl)
    .then((response) => {
      logApi('main page loaded successfully');
      const $ = cheerio.load(response.data);

      Object.entries(resourceTags).forEach(([tagName, attrName]) => {
        $(tagName).each((_, element) => {
          const attrValue = $(element).attr(attrName);
          if (!attrValue) return;

          const assetUrl = new URL(attrValue, originUrl.href);

          if (assetUrl.hostname === originUrl.hostname) {
            if (assetUrl.pathname === originUrl.pathname && tagName === 'link' && $(element).attr('rel') === 'canonical') {
              const localPathForHtml = path.join(assetsDirname, mainHtmlFilename);
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
              downloadUrl: assetUrl.toString(),
              savePath: absoluteSavePath,
            });

            $(element).attr(attrName, localPathForHtml);
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
              .then((res) => fs.writeFile(asset.savePath, res.data));
          });
          return Promise.all(promises);
        })
        .then(() => fs.writeFile(mainHtmlPath, modifiedHtml, 'utf-8'))
        .then(() => mainHtmlPath);
    });
};

export default pageLoader;
