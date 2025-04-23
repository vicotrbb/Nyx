import { LoggerFunc } from '../agents/workerAgent';
import { defaultLogger } from '../../utils/logger';
import https from 'https';
import http from 'http';

async function fetchUrlContent(
  url: string,
  logger: LoggerFunc
): Promise<string> {
  logger(`Fetching URL content: ${url}`, 'info');

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, (res) => {
        const { statusCode } = res;

        if (statusCode === undefined || statusCode < 200 || statusCode >= 300) {
          const errMsg = `Request Failed. Status Code: ${statusCode}`;
          logger(`Error fetching URL ${url}: ${errMsg}`, 'error');

          res.resume();
          reject(new Error(errMsg));
          return;
        }

        const dataChunks: Uint8Array[] = [];

        res.on('data', (chunk: Uint8Array) => dataChunks.push(chunk));
        res.on('end', () => {
          const content = Buffer.concat(dataChunks).toString('utf8');
          logger(`Successfully fetched content for URL: ${url}`, 'info');

          resolve(content);
        });
      })
      .on('error', (err) => {
        logger(`Error fetching URL ${url}: ${err.message}`, 'error');
        reject(err);
      });
  });
}

/**
 * Opens a given URL and returns its content.
 * @param args - Object containing the URL to open.
 * @param args.url - The URL of the webpage to fetch content from.
 * @param logger - Optional logger function.
 * @returns A promise that resolves with the content of the webpage.
 */
export async function openUrl(
  args: { url: string },
  logger: LoggerFunc = defaultLogger
): Promise<string> {
  const { url } = args;

  if (!url) {
    logger('URL argument is missing for openUrl', 'error');
    throw new Error('Missing required argument: url');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (err: any) {
    logger(`Invalid URL provided to openUrl: ${url}`, 'error');
    throw new Error(`Invalid URL: ${url}`);
  }

  logger(`Executing openUrl with URL: ${parsedUrl.href}`, 'info');
  return fetchUrlContent(parsedUrl.href, logger);
}
