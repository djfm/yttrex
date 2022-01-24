import { Page } from 'puppeteer';

import { Logger } from '../util/logger';

export interface RunOptions {
  createPage: (profileDirectory: string) => Promise<Page>;
  logger: Logger;
  profileDirectory: string;
  projectDirectory: string;
}
