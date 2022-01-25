import { Page } from 'puppeteer';

import { Logger } from '@util/logger';
import { MinimalProjectConfig } from '@project/index';

export interface InitOptions {
  projectDirectory: string;
  logger: Logger;
}

export type RunOptions = InitOptions & {
  page: Page;
  project: MinimalProjectConfig;
};

export interface ExperimentDescriptor {
  experimentType: string;
  init(options: InitOptions): Promise<void>;
  run(options: RunOptions): Promise<Page>;
}

export default ExperimentDescriptor;
