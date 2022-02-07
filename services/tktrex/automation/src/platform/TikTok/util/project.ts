import { createReadStream } from 'fs';
import { mkdir } from 'fs/promises';

import { Page } from 'puppeteer';
import unzipper from 'unzipper';

import {
  generateDirectoryStructure,
  getAssetPath,
} from '@project';

import { flatCopyFiles } from '@util/fs';
import { Logger } from '@util/logger';
import { askConfirmation } from '@util/page';
import { ProfileState } from '@project/state';
import { InitOptions } from '@experiment/index';

export const init = async({
  projectDirectory,
  experimentType,
}: InitOptions): Promise<void> => {
  const assetPath = getAssetPath('TikTok');
  const { extensionDirectory, profileDirectory } =
    generateDirectoryStructure(
      projectDirectory, { withExtension: true },
    );

  await mkdir(extensionDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });

  const extZipPath = assetPath('tktrex-extension-0.2.6.zip');

  const stream = createReadStream(extZipPath).pipe(
    unzipper.Extract({
      path: extensionDirectory,
    }),
  );

  await new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
  });

  await flatCopyFiles(assetPath(experimentType), projectDirectory);
};

export const showBasicInfo = (
  logger: Logger,
  profileState: ProfileState,
): void => {
  if (profileState.getNTimesUsed() === 1) {
    logger.log(
      'First time using this profile, so:',
      '',
      '> Please remember to resolve any kind of user interaction',
      '> that is not handled automatically in the browser!',
      '',
      'This script will attempt to warn you when it requires human interaction.',
    );
  }
};

export const confirmPublicKeyNoted = async(
  page: Page,
  profileState: ProfileState,
): Promise<void> => {
  if (profileState.getNTimesUsed() === 1) {
    const confirm = askConfirmation(page);

    await confirm(
      'It looks like you\'re running this experiment for the first time.',
      '',
      'Please remember to take note of your public key from your personal page.',
      'This page can be accessed from the extension menu.',
    );
  }
};

export default init;
