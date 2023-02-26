import * as Options from './types/options.js';
import { Logger } from './types/logger.js';
export declare const LOG_NONE = "none";
export declare const LOG_ERROR = "error";
export declare const LOG_WARN = "warn";
export declare const LOG_INFO = "info";
export declare const LOG_VERBOSE = "verbose";
declare const Logger: ({ logLevel: logSetting, logOutput }: Options.LoggerOptions) => Logger;
export default Logger;
