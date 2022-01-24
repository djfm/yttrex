import {
  join,
} from 'path';

import { ExperimentType } from './initProject';

export interface InitOptions {
  directory: string;
  experimentType: ExperimentType;
}

export const init = async({
  directory,
  experimentType,
}: InitOptions): Promise<void> => {
  const profileDirectory = join(directory, 'profile');
};

export default init;
