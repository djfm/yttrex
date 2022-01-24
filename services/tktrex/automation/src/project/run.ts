import { readFile } from 'fs/promises';
import { join } from 'path';

import yaml from 'yaml';

import { fileExists } from '../util/general';
import { createLogger } from '../util/logger';
import { run as tikTokRun } from '../platform/TikTok/project';
import { experimentTypes } from './init';

export interface RunOptions {
  directory: string;
}

export const run = async({ directory }: RunOptions): Promise<void> => {
  const logger = createLogger();

  const configPath = join(directory, 'config.yaml');

  if (!(await fileExists(configPath))) {
    throw new Error(
      `config.yaml not found in "${directory}", was the project initialized?`,
    );
  }

  const rawConfig = yaml.parse(await readFile(configPath, 'utf8'));

  if (!experimentTypes.includes(rawConfig.experimentType)) {
    throw new Error(`unknown experiment type: "${rawConfig.experimentType}"`);
  }

  logger.log(
    `Running "${rawConfig.experimentType}" experiment in "${directory}"...`,
  );

  if (rawConfig.experimentType.startsWith('tt-')) {
    const page = await tikTokRun({
      directory,
      rawConfig,
    });

    await page.browser().close();

    logger.log('Done running experiment!');
    process.exit(0);
  }

  throw new Error(`unknown experiment type: "${rawConfig.experimentType}"`);
};

export default run;
