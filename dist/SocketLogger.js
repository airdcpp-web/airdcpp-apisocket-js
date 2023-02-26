"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_VERBOSE = exports.LOG_INFO = exports.LOG_WARN = exports.LOG_ERROR = exports.LOG_NONE = void 0;
const chalk_1 = __importDefault(require("chalk"));
const invariant_1 = __importDefault(require("invariant"));
exports.LOG_NONE = 'none';
exports.LOG_ERROR = 'error';
exports.LOG_WARN = 'warn';
exports.LOG_INFO = 'info';
exports.LOG_VERBOSE = 'verbose';
const Severities = {
    [exports.LOG_NONE]: -1,
    [exports.LOG_ERROR]: 0,
    [exports.LOG_WARN]: 1,
    [exports.LOG_INFO]: 2,
    [exports.LOG_VERBOSE]: 3,
};
// Should we format the line with timestamp and coloring or let the logger implementation to handle it?
// Do this when running in terminal (node.js/tests in browser env)
const shouldFormatLine = true;
const Logger = ({ logLevel: logSetting = exports.LOG_VERBOSE, logOutput = console }) => {
    const logLevel = Severities[logSetting];
    (0, invariant_1.default)(
    // @ts-ignore: This condition will always return true since the function is always defined
    logOutput.log && logOutput.info && logOutput.warn && logOutput.error, 'Invalid logOutput provided');
    const formatCurrentTime = () => {
        const d = new Date();
        return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}:${d.getMilliseconds()}]`;
    };
    const print = (args, printHandler, argFormat) => {
        let printableArgs = [...Array.prototype.slice.call(args)];
        if (shouldFormatLine && argFormat) {
            // Add the current time as well
            printableArgs = [
                chalk_1.default.magenta(formatCurrentTime()),
                ...printableArgs.map(arg => argFormat(typeof arg === 'object' ? JSON.stringify(arg, null, '  ') : arg)),
            ];
        }
        printHandler.apply(logOutput, printableArgs);
    };
    const Impl = {
        verbose() {
            if (logLevel < Severities[exports.LOG_VERBOSE]) {
                return;
            }
            print(arguments, logOutput.log, chalk_1.default.gray);
        },
        info() {
            if (logLevel < Severities[exports.LOG_INFO]) {
                return;
            }
            print(arguments, logOutput.info, chalk_1.default.white.bold);
        },
        warn() {
            if (logLevel < Severities[exports.LOG_WARN]) {
                return;
            }
            print(arguments, logOutput.warn, chalk_1.default.yellow.bold);
        },
        error() {
            if (logLevel < Severities[exports.LOG_ERROR]) {
                return;
            }
            print(arguments, logOutput.error, chalk_1.default.red.bold);
        },
    };
    return Impl;
};
exports.default = Logger;
//# sourceMappingURL=SocketLogger.js.map