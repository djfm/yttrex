/* eslint-disable no-console */

export interface Logger {
  // eslint-disable-next-line
  log(...lines: unknown[]): void;
}

const trim =
  (n: number) =>
    (x: string): string =>
      x.length > n ? `${x.slice(0, n - 6)} [...]` : x;
const quote = (str: string): string => `>  ${str}`;

const ifMany =
  <T>(x: T[]) =>
    (...mappers: Array<(x: T) => T>): T[] =>
      x.length < 2 ? x : x.map((y) => mappers.reduce((z, f) => f(z), y));

const toStringGroups = (x: unknown[]): string[][] =>
  x.map((y) =>
    typeof y === 'string'
      ? [y]
      : ifMany(JSON.stringify(y, null, 2).split('\n'))(trim(80), quote),
  );

export const createLogger = (): Logger => {
  const maxVSPace = 2;

  let paddingTopRequested = 0;
  let paddingBottomRequested = 0;
  let lastMessage: string | undefined;
  let paddingTopAdded = 0;
  let indent = 0;

  const indentChar = (n = indent): string => {
    if (n < 1) {
      return '';
    }
    if (n < 2) {
      return ' # ';
    }
    if (n < 3) {
      return ' | ';
    }
    if (n < 4) {
      return ' . ';
    }

    return '';
  };

  const requestPaddingTop = (): void => {
    paddingTopRequested = Math.min(maxVSPace, paddingTopRequested + 1);
  };

  const requestPaddingBottom = (): void => {
    paddingBottomRequested = Math.min(maxVSPace, paddingBottomRequested + 1);
  };

  const startGroup = (): void => {
    requestPaddingTop();
    indent += 1;
  };

  const endGroup = (): void => {
    requestPaddingBottom();
    indent -= 1;
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

      const indentation = Array.from({ length: indent })
        .map(() => '  ')
        .concat(indentChar())
        .join('');

      console.log(`${indentation}${line}`);
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
