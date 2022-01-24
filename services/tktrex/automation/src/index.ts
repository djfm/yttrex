/* eslint-disable no-console */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import { getChromePath } from '@guardoni/guardoni/utils';

import searchOnTikTok from './searchOnTikTok';

import init, {
  experimentTypes,
} from './initProject';

const searchOnTikTokCommand = async({
  file,
  url,
  profile,
  proxy,
  extensionSource,
}: {
  file: string;
  url: string;
  profile: string;
  extensionSource?: string;
  proxy?: string;
}): Promise<void> => {
  void pipe(
    getChromePath(),
    TE.fromEither,
    TE.map((chromePath) => ({
      chromePath,
      extensionSource,
      file,
      profile,
      proxy,
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
          type: 'string',
        })
        .option('proxy', {
          alias: 'x',
          desc: 'Proxy to use for the instrumented chrome browser',
          type: 'string',
        }),
    (args) => searchOnTikTokCommand(args),
  )
  .command(
    'init [directory]',
    'Initialize an experiment directory',
    (y) => y
      .positional('directory', {
        default: '.',
        desc: 'Directory to initialize, current directory if empty',
        type: 'string',
      })
      .option('experiment-type', {
        alias: 't',
        demandOption: true,
        desc: 'Type of experiment to initialize (e.g. "search-on-tiktok")',
        type: 'string',
        default: 'search-on-tiktok',
        choices: experimentTypes,
      }),
    (args) => init(args),
  );

void menu.strictCommands().demandCommand(1, 'Please provide a command').parse();
