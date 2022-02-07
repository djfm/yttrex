import { join, resolve } from 'path';

import * as t from 'io-ts';

import { Page } from 'puppeteer';

import { Logger } from '../util/logger';

type Platform = 'Facebook' | 'TikTok';

export const MinimalProjectConfig = t.type({
  experimentType: t.string,
  useStealth: t.boolean,
  proxy: t.union([t.null, t.string]),
});
export type MinimalProjectConfig = t.TypeOf<typeof MinimalProjectConfig>;

export interface RunOptions {
  createPage: (profileDirectory: string) => Promise<Page>;
  logger: Logger;
  profileDirectory: string;
  projectDirectory: string;
  project: MinimalProjectConfig;
}

export interface DirectoryStructureOptions {
  withExtension: boolean;
}

export const generateDirectoryStructure = (
  projectDirectory: string,
  options: DirectoryStructureOptions,
): Record<string, string> => ({
  profileDirectory: join(projectDirectory, 'profile'),
  projectDirectory,
  extensionDirectory: join(projectDirectory, 'profile/tx.extension'),
  databaseDirectory: join(projectDirectory, 'database'),
  metaDataDirectory: join(projectDirectory, 'metaData'),
});

export const getAssetPath = (platform: Platform) => (path: string): string =>
  // TODO: this is brittle
  resolve(__dirname, '../../assets/', platform, path);
