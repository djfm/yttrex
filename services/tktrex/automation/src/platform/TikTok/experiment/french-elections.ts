import { join } from 'path';

import * as t from 'io-ts';

import { ExperimentDescriptor } from '@experiment/index';
import { decodeOrThrow } from '@util/fp';
import { copyFromTo, sleep } from '@util/general';
import { createHandleCaptcha, ensureLoggedIn } from '@TikTok/util/page';
import { loadQueriesCSV } from '@util/csv';
import { askConfirmation, fillInput } from '@util/page';
import { loadProfileState } from '@project/state';
import { getAssetPath, init as tikTokInit } from '@TikTok/util/project';
import { MinimalProjectConfig } from '@project/index';

const Config = t.intersection([
  MinimalProjectConfig,
  t.type({
    baseURL: t.string,
  }, 'baseURL'),
], 'Config');
type Config = t.TypeOf<typeof Config>;

export const FrenchElections: ExperimentDescriptor = {
  experimentType: 'tt-french-elections',
  init: async({ projectDirectory }) => {
    await tikTokInit({ projectDirectory });
    const cp = copyFromTo(getAssetPath('.'), projectDirectory);

    await cp({
      'french-elections-monitoring-config.yaml': 'config.yaml',
      'french-elections-monitoring-queries.csv': 'queries.csv',
      'search.README.md': 'README.md',
    });
  },
  run: async({
    page, logger, projectDirectory,
    project: minimalConfig,
  }) => {
    const project = decodeOrThrow(Config)(minimalConfig);

    // TODO: how can this be made type safe?
    const queries = await loadQueriesCSV(join(projectDirectory, 'queries.csv'));

    const profileState = await loadProfileState(projectDirectory);
    const handleCaptcha = createHandleCaptcha(page, logger);
    const confirm = askConfirmation(page);

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

    await page.goto(project.baseURL);

    await handleCaptcha();
    await ensureLoggedIn(page);

    if (profileState.getNTimesUsed() === 1) {
      await confirm(
        'It looks like you\'re running this experiment for the first time.',
        '',
        'Please remember to take note of your public key from your personal page.',
        'This page can be accessed from the extension menu.',
      );
    }

    for (const query of queries) {
      logger.log(`Searching for "${query}"...`);

      await fillInput(page, '[data-e2e="search-user-input"', query);
      await page.keyboard.press('Enter');
      await handleCaptcha();
      await sleep(5000);
    }

    return page;
  },
};

export default FrenchElections;
