/* eslint-disable no-console */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import { getChromePath } from '@guardoni/guardoni/utils';

import searchOnTikTok from './searchOnTikTok';

const searchOnTikTokCommand = async({
  file,
  url,
  profile,
  extensionSource,
}: {
  file: string;
  url: string;
  profile: string;
  extensionSource: string;
}): Promise<void> => {
  void pipe(
    getChromePath(),
    TE.fromEither,
    TE.map((chromePath) => ({
      chromePath,
      extensionSource,
      file,
      profile,
      url,
    })),
    TE.chain(searchOnTikTok),
    TE.map(async(page) => {
      console.log('done!');
      process.exit(0);
    }),
    TE.mapLeft((e) => {
      console.error(e);
      process.exit(1);
    }),
  )();
};

const menu = yargs(hideBin(process.argv))
  .scriptName('tktrex-automation')
  .command(
    'search-on-tiktok <file>',
    'Run the queries included in <file> on TikTok',
    (y) =>
      y
        .positional('file', {
          demandOption: true,
          desc: 'File containing one query and URL per line',
          type: 'string',
        })
        .option('url', {
          alias: 'u',
          demandOption: true,
          desc: 'Base URL to make the search on (e.g. https://tiktok.com/fr)',
          type: 'string',
        })
        .option('profile', {
          alias: 'p',
          demandOption: true,
          desc: 'Path to a profile to use for this search experiment',
          type: 'string',
        })
        .option('extension-source', {
          alias: 'e',
          desc: 'Where to get the extension from (e.g. https://tiktok.tracking.exposed/ext.zip or ~/work/tk.zip)',
          default: 'user-installed',
          type: 'string',
        }),
    (args) => searchOnTikTokCommand(args),
  );

void menu.strictCommands().demandCommand(1, 'Please provide a command').parse();
