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

  let paddingRequested = 0;
  let lastMessage: string | undefined;
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

  const requestPadding = (): void => {
    paddingRequested = Math.min(maxVSPace, paddingRequested + 1);
  };

  const startGroup = (): void => {
    requestPadding();
    indent += 1;
  };

  const endGroup = (): void => {
    requestPadding();
    indent -= 1;
  };

  const padOne = (): void => {
    if (paddingRequested > 0) {
      console.log('');
      paddingRequested -= 1;
    }
  };

  const padAll = (): void => {
    // This lint is wrong here.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (paddingRequested > 0) {
      padOne();
    }
  };

  const printLine = (line: string): void => {
    if (!line) {
      requestPadding();
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
