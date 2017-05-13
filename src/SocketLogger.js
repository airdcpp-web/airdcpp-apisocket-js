import chalk from 'chalk';
import isBrowser from 'is-in-browser';
import invariant from 'invariant';

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


const allowFormatArgs = !isBrowser || (process && process.env && process.env.NODE_ENV === 'test');

const Logger = ({ logLevel = LOG_VERBOSE, loggerOutput = console }) => {
	logLevel = Severities[logLevel];

	invariant(
		loggerOutput.log && loggerOutput.info && loggerOutput.warn && loggerOutput.error,
		'Invalid loggerOutput provided'
	);

	const formatCurrentTime = () => {
		const d = new Date();
		return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}:${d.getMilliseconds()}]`;
	};

	const print = (args, printHandler, argFormat) => {
		let printableArgs = [ ...Array.prototype.slice.call(args) ];

		if (allowFormatArgs && argFormat) {
			// Add the current time as well
			printableArgs = [
				chalk.magenta(formatCurrentTime()),
				...printableArgs.map(arg => argFormat(typeof arg === 'object' ? JSON.stringify(arg, null, '  ') : arg)),
			];
		}

		printHandler.apply(loggerOutput, printableArgs);
	};

	const Impl = {
		verbose() {
			if (logLevel < Severities[LOG_VERBOSE]) {
				return;
			}

			print(arguments, loggerOutput.log, chalk.gray);
		},

		info() {
			if (logLevel < Severities[LOG_INFO]) {
				return;
			}

			print(arguments, loggerOutput.info, chalk.white.bold);
		},

		warn() {
			if (logLevel < Severities[LOG_WARN]) {
				return;
			}

			print(arguments, loggerOutput.warn, chalk.yellow.bold);
		},

		error() {
			if (logLevel < Severities[LOG_ERROR]) {
				return;
			}

			print(arguments, loggerOutput.error, chalk.red.bold);
		},
	};

	return Impl;
};

export default Logger;
