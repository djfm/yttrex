import crypto from 'crypto';
import PouchDB from 'pouchdb';

import { Snapshot } from '../scraper/lib';
import { generateDirectoryStructure } from '@project/index';

export interface Db {
  save: (snapshot: Snapshot) => Promise<void>;
}

export const init = (projectDirectory: string): Promise<Db> => {
  const { databaseDirectory } = generateDirectoryStructure(projectDirectory);
  const pouch = new PouchDB(databaseDirectory);

  const save = async(snapshot: Snapshot): Promise<void> => {
    const _id = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');

    await pouch.put({ ...snapshot, _id });
  };

  return Promise.resolve({
    save,
  });
};

export default init;
