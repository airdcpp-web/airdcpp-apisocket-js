import chalk from 'chalk';
// @ts-ignore
import { isBrowser } from 'is-in-browser';
import invariant from 'invariant';

import * as Options from './types/options.js';
import { Logger } from './types/logger.js';


export const LOG_NONE = 'none';
export const LOG_ERROR = 'error';
export const LOG_WARN = 'warn';
export const LOG_INFO = 'info';
export const LOG_VERBOSE = 'verbose';

const Severities = {
  [LOG_NONE]: -1,
  [LOG_ERROR]: 0,
  [LOG_WARN]: 1,
  [LOG_INFO]: 2,
  [LOG_VERBOSE]: 3,
};


// Should we format the line with timestamp and coloring or let the logger implementation to handle it?
// Do this when running in terminal (node.js/tests in browser env)
const shouldFormatLine = !isBrowser || 
  (process.env.NODE_ENV === 'test');

const Logger = ({ logLevel: logSetting = LOG_VERBOSE, logOutput = console }: Options.LoggerOptions) => {
  const logLevel = Severities[logSetting];

  invariant(
    // @ts-ignore: This condition will always return true since the function is always defined
    logOutput.log && logOutput.info && logOutput.warn && logOutput.error,
    'Invalid logOutput provided'
  );

  const formatCurrentTime = () => {
    const d = new Date();
    return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}:${d.getMilliseconds()}]`;
  };

  const print = (args: IArguments, printHandler: Options.PrintHandler, argFormat: (arg: string) => string) => {
    let printableArgs = [ ...Array.prototype.slice.call(args) ];

    if (shouldFormatLine && argFormat) {
      // Add the current time as well
      printableArgs = [
        chalk.magenta(formatCurrentTime()),
        ...printableArgs.map(arg => argFormat(typeof arg === 'object' ? JSON.stringify(arg, null, '  ') : arg)),
      ];
    }

    printHandler.apply(logOutput, printableArgs);
  };

  const Impl: Logger = {
    verbose() {
      if (logLevel < Severities[LOG_VERBOSE]) {
        return;
      }
      
      print(arguments, logOutput.log, chalk.gray);
    },

    info() {
      if (logLevel < Severities[LOG_INFO]) {
        return;
      }

      print(arguments, logOutput.info, chalk.white.bold);
    },

    warn() {
      if (logLevel < Severities[LOG_WARN]) {
        return;
      }

      print(arguments, logOutput.warn, chalk.yellow.bold);
    },

    error() {
      if (logLevel < Severities[LOG_ERROR]) {
        return;
      }

      print(arguments, logOutput.error, chalk.red.bold);
    },
  };

  return Impl;
};

export default Logger;
