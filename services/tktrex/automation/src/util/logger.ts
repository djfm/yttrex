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
  const maxVSPace = 2;

  let paddingTopRequested = 0;
  let paddingBottomRequested = 0;
  let lastMessage: string | undefined;
  let paddingTopAdded = 0;

  const requestPaddingTop = (): void => {
    paddingTopRequested = Math.min(maxVSPace, paddingTopRequested + 1);
  };

  const requestPaddingBottom = (): void => {
    paddingBottomRequested = Math.min(maxVSPace, paddingBottomRequested + 1);
  };

  const startGroup = (): void => {
    requestPaddingTop();
  };

  const endGroup = (): void => {
    requestPaddingBottom();
  };

  const padOne = (): void => {
    if (paddingTopRequested > 0) {
      console.log('');
      paddingTopRequested -= 1;
      paddingTopAdded += 1;

      if (paddingTopRequested === 0) {
        paddingTopRequested = paddingBottomRequested;
        paddingBottomRequested = 0;
      }
    }
  };

  const padAll = (): void => {
    // This lint is wrong here.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (paddingTopRequested - paddingTopAdded > 0) {
      padOne();
    }
    paddingTopAdded = 0;
  };

  const printLine = (line: string): void => {
    if (!line) {
      requestPaddingTop();
    } else {
      if (line !== lastMessage) {
        padAll();
      }
      lastMessage = line;
      console.log(line);
    }
  };

  const wrapVerticallyIf = (shouldWrap: boolean, cb: () => void): void => {
    if (shouldWrap) {
      startGroup();
    }
    cb();
    if (shouldWrap) {
      endGroup();
    }
  };

  const log = (...lines: unknown[]): void => {
    const groups = toStringGroups(lines);

    wrapVerticallyIf(lines.length > 1, () => {
      for (const group of groups) {
        wrapVerticallyIf(group.length > 1, () => {
          for (const line of group) {
            printLine(line);
          }
        });
      }
    });
  };

  return {
    log,
  };
};

export default createLogger;
