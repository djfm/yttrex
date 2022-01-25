import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Snapshot {
  url: string;
  html: string;
  scrapedOn: Date;
  metaData?: {
    query: string;
  };
}

export class SnapshotStore {
  private results: Snapshot[] = [];

  constructor(private readonly directory: string) {}

  getPath: () => string = () => join(this.directory, 'scraping.db.json');

  async get(): Promise<Snapshot[]> {
    try {
      const rawStorage = await readFile(this.getPath(), 'utf8');
      const storage = JSON.parse(rawStorage);
      this.results = storage;
      return this.results;
    } catch (e) {
      return this.results;
    }
  }

  async save(): Promise<SnapshotStore> {
    const storage = JSON.stringify(this.results, null, 2);
    await writeFile(this.getPath(), storage);
    return this;
  }

  async add(...results: Snapshot[]): Promise<SnapshotStore> {
    if (this.results.length === 0) {
      await this.get();
    }

    this.results.push(...results);
    return this.save();
  }
}
