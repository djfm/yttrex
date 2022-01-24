/* eslint-disable no-console */

export interface Logger {
  // eslint-disable-next-line
  log(...lines: unknown[]): void;
}

const toStringGroups = (x: unknown[]): string[][] =>
  x.map((y) =>
    typeof y === 'string' ? [y] : JSON.stringify(y, null, 2).split('\n'),
  );

export const createLogger = (): Logger => {
  let groupJustClosed = false;

  const openGroup = (): void => {
    console.log();
  };

  const closeGroup = (): void => {
    groupJustClosed = true;
  };

  const print = (line: string): void => {
    if (groupJustClosed) {
      groupJustClosed = false;
      console.log();
    }
    console.log(line);
  };

  const log = (...lines: unknown[]): void => {
    const groups = toStringGroups(lines);

    for (const group of groups) {
      if (group.length > 1) {
        openGroup();
      }
      for (const line of group) {
        print(line);
      }
      if (group.length > 1) {
        closeGroup();
      }
    }
  };

  return {
    log,
  };
};

export default createLogger;
