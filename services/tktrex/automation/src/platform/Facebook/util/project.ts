import { InitOptions } from '@experiment/index';

import {
  generateDirectoryStructure,
  getAssetPath,
} from '@project/index';

import { flatCopyFiles } from '@util/fs';
import { mkdir } from 'fs/promises';

export const init = async({
  projectDirectory,
  experimentType,
}: InitOptions): Promise<void> => {
  const assetPath = getAssetPath('Facebook');
  const { extensionDirectory, profileDirectory } =
    generateDirectoryStructure(
      projectDirectory, { withExtension: true },
    );

  await mkdir(extensionDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });

  await flatCopyFiles(assetPath(experimentType), projectDirectory);
};
