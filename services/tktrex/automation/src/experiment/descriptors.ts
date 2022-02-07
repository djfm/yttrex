import ttFrenchElections from '@TikTok/experiment/french-elections';
import fbScrapeGroupFeed from '@Facebook/experiment/scrape-group-feed';

export const descriptors = [
  ttFrenchElections,
  fbScrapeGroupFeed,
];

export const experimentTypes = descriptors.map(
  (d) => d.experimentType,
);

export default descriptors;
