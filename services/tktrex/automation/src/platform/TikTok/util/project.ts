import { resolve } from 'path';
import { createReadStream } from 'fs';
import { mkdir } from 'fs/promises';

import unzipper from 'unzipper';

import { generateDirectoryStructure } from '@project/index';

export const getAssetPath = (path: string): string =>
  // TODO: this is brittle
  resolve(__dirname, '../../../../assets/TikTok', path);

interface InitOptions {
  projectDirectory: string;
}

export const init = async({
  projectDirectory,
}: InitOptions): Promise<void> => {
  const { extensionDirectory, profileDirectory } =
    generateDirectoryStructure(projectDirectory);

  await mkdir(extensionDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });

  const extZipPath = getAssetPath('tktrex-extension-0.2.6.zip');

  const stream = createReadStream(extZipPath).pipe(
    unzipper.Extract({
      path: extensionDirectory,
    }),
  );

  await new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
  });
};

export default init;
