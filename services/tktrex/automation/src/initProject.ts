/* eslint-disable no-console */

import {
  mkdir,
} from 'fs/promises';

import {
  isEmptyDirectoryOrDoesNotExist,
} from './util';

import initTikTokProject from './tikTokProject';

export const experimentTypes: readonly string[] = ['search-on-tiktok'] as const;

export type ExperimentType = typeof experimentTypes[number];

export interface initOptions {
  directory: string;
  experimentType: ExperimentType;
}

export const init = async({
  directory,
  experimentType,
}: initOptions): Promise<void> => {
  console.log(`Initializing "${experimentType}" experiment in "${directory}"...`);

  const ok = await isEmptyDirectoryOrDoesNotExist(directory);

  if (ok !== true) {
    const msg = ok === 'directory-not-empty'
      ? 'the directory is not empty'
      : 'the provided path is not a directory';

    console.log(`..failed: ${msg}.`);
    throw new Error(`${msg}: "${directory}"`);
  }

  await mkdir(directory, { recursive: true });

  switch (experimentType) {
  case 'search-on-tiktok':
    await initTikTokProject({
      directory,
      experimentType,
    });
    break;
  default:
    throw new Error(`unknown experiment type: "${experimentType}"`);
  }

  console.log('...ok.');
};

export default init;
