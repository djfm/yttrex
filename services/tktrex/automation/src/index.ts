import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import init, { experimentTypes } from './project/init';

import run from './project/run';

const menu = yargs(hideBin(process.argv))
  .scriptName('tktrex-automation')
  .command(
    'init [directory]',
    'Initialize an experiment directory',
    (y) =>
      y
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
          default: experimentTypes[0],
          choices: experimentTypes,
        }),
    (args) => init(args),
  )
  .command(
    'run [directory]',
    'Run an experiment from a directory previously initialized',
    (y) =>
      y.positional('directory', {
        default: '.',
        desc: 'Directory containing the initialized experiment to run, current directory if empty',
        type: 'string',
      }),
    (args) => run(args),
  );

void menu.strictCommands().demandCommand(1, 'Please provide a command').parse();
