import { readFile } from 'fs/promises';

import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/lib/TaskEither';

import yargs from 'yargs';
import parseCSV from 'csv-parse/lib/sync';

import { CommandCreator, CommandConfig } from '../models/CommandCreator';
import { AutomationScenario, SearchStep } from '@shared/models/Automation';

import { GetAPI } from '@shared/providers/api.provider';

import { dryRunAutomation } from '../lib/runScenario';

interface CLIOptions {
  type: string,
  file: string,
  description?: string,
  label?: string,
  ttUsername?: string,
  ttPassword?: string,
}

export const recordToStep = (record: Record<string, string>): SearchStep => {
  if (Object.keys(record).length !== 1) {
    throw new Error('invalid record, expected 1 column only');
  }

  if (!record.query) {
    throw new Error('invalid record, expected a "query" column');
  }

  return {
    type: 'search',
    platform: 'tiktok',
    platformURL: 'https://tiktok.com/fr',
    query: record.query,
  };
};

export const createScenarioFromFile = async({
  type,
  file,
  description,
  label,
  ttUsername,
  ttPassword,
}: CLIOptions): Promise<AutomationScenario> => {
  if (type !== 'tiktok-fr-elections') {
    throw new Error(`unsupported automation type: ${type}`);
  }

  const fileContents = await readFile(file, 'utf8');

  const records = parseCSV(fileContents, {
    columns: true,
    skip_empty_lines: true,
  });

  if (!(records instanceof Array)) {
    throw new Error('invalid records, expected an array');
  }

  const steps = records.map(recordToStep);

  const scenario: AutomationScenario = {
    type,
    description,
    label,
    script: steps,
    createdAt: new Date().toISOString() as any,
    credentials: {
      tiktok: (ttUsername && ttPassword) ? {
        username: ttUsername,
        password: ttPassword,
      } : undefined,
    },
  };

  return scenario;
};

export const registerAutomation =
  (config: CommandConfig) =>
    async({
      type,
      file,
      description,
      label,
    }: CLIOptions): Promise<void> => {
      config.log.info('registering automation for "%s"...', type);

      const scenario = await createScenarioFromFile({
        type,
        file,
        description,
        label,
      });

      config.log.info('created scenario with %d steps', scenario.script.length);

      const { API } = GetAPI({
        baseURL: config.API_BASE_URL,
      });

      const endpoint = API.automation.v0.CreateScenario;

      void pipe(
        {
          Body: scenario,
        },
        endpoint,
        // eslint-disable-next-line array-callback-return
        TE.map(() => {
          config.log.info('automation registered');
        }),
        TE.mapLeft((error) => {
          config.log.error('automation registration failed');
          config.log.error('%o', error);
        }),
      )();
    };

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const addArguments = (y: yargs.Argv) =>
  y
    .positional('file', {
      demandOption: true,
      desc: 'File containing one automation step per line',
      type: 'string',
    })
    .option('description', {
      alias: 'd',
      desc: 'Save a comment together with this automation',
      type: 'string',
    })
    .option('label', {
      alias: 'l',
      desc: 'Save a label together with this automation',
      type: 'string',
    })
    .option('type', {
      alias: 't',
      desc: 'Automation type',
      type: 'string',
      demandOption: true,
      choices: ['tiktok-fr-elections'],
    })
    .option('tt-username', {
      alias: 'ttu',
      desc: 'TikTok username',
      type: 'string',
    })
    .option('tt-password', {
      alias: 'ttp',
      desc: 'TikTok password',
      type: 'string',
    });

export const registerAutomationCommand: CommandCreator = {
  add: (config) => (yargs) =>
    yargs
      .command(
        'register <file>',
        'Register an automation file',
        addArguments,
        async(argv) => registerAutomation(config)(argv),
      )
      .command(
        'dry-run <file>',
        'Try-out an automation file',
        addArguments,
        async(argv) => {
          const scenario = await createScenarioFromFile(argv);
          await dryRunAutomation(config)(scenario);
        },
      ),
};

export default registerAutomationCommand;
