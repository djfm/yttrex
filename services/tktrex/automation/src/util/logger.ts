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

  let lineBreaksToPrepend = 0;
  let lineBreaksPrepended = 0;

  const requestLineBreak = (): void => {
    lineBreaksToPrepend = Math.min(maxVSPace, lineBreaksToPrepend + 1);
  };

  const prependLineBreak = (): void => {
    if (lineBreaksPrepended < lineBreaksToPrepend) {
      console.log();
      lineBreaksPrepended += 1;

      if (lineBreaksPrepended === lineBreaksToPrepend) {
        lineBreaksToPrepend = 0;
        lineBreaksPrepended = 0;
      }
    }
  };

  const print = (line: string): void => {
    if (!line) {
      prependLineBreak();
    } else {
      for (let i = lineBreaksPrepended; i < lineBreaksToPrepend; i += 1) {
        prependLineBreak();
      }
      console.log(line);
    }
  };

  const log = (...lines: unknown[]): void => {
    const groups = toStringGroups(lines);

    if (lines.length > 1) {
      requestLineBreak();
    }

    for (const group of groups) {
      if (group.length > 1) {
        requestLineBreak();
      }
      for (const line of group) {
        print(line);
      }
      if (group.length > 1) {
        requestLineBreak();
      }
    }

    if (lines.length > 1) {
      requestLineBreak();
    }
  };

  return {
    log,
  };
};

export default createLogger;
