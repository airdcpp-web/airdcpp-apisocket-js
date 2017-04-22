import chalk from 'chalk';
import isBrowser from 'is-in-browser';

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

const Logger = ({ logLevel = LOG_VERBOSE }) => {
	logLevel = Severities[logLevel];

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

		printHandler.apply(console, printableArgs);
	};

	const Impl = {
		verbose() {
			if (logLevel < Severities[LOG_VERBOSE]) {
				return;
			}

			print(arguments, console.log, chalk.gray);
		},

		/*success() {
			if (logLevel < Severities[LOG_INFO]) {
				return;
			}

			print(arguments, console.info, chalk.green);
		},*/

		info() {
			if (logLevel < Severities[LOG_INFO]) {
				return;
			}

			print(arguments, console.info, chalk.white.bold);
		},

		warn() {
			if (logLevel < Severities[LOG_WARN]) {
				return;
			}

			print(arguments, console.warn, chalk.yellow.bold);
		},

		error() {
			if (logLevel < Severities[LOG_ERROR]) {
				return;
			}

			print(arguments, console.warn, chalk.red.bold);
		},
	};

	return Impl;
};

export default Logger;
