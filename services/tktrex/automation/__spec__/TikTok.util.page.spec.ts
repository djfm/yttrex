import { getAssetPath } from '@project/index';
import { fileExists } from '@util/fs';

describe('the "getAssetPath" method for TikTok', () => {
  it('should find an asset', async(): Promise<void> => {
    const path = getAssetPath('TikTok')('tktrex-extension-0.2.6.zip');
    expect(await fileExists(path)).toBe(true);
    const exists = await fileExists(path);
    expect(exists).toBe(true);
  });
});
