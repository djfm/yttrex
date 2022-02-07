import { ExperimentDescriptor } from '@experiment';
import { init } from '@Facebook/util/project';

const experimentType = 'fb-scrape-group-feed';

export const ScrapeGroupFeed: ExperimentDescriptor = {
  experimentType,
  init: async({ projectDirectory, logger }) => init({
    projectDirectory,
    experimentType,
    logger,
  }),
  run: async({
    page,
    logger,
    projectDirectory,
    project: minimalConfig,
    saveSnapshot,
  }) => {

    return page;
  },
};

export default ScrapeGroupFeed;
