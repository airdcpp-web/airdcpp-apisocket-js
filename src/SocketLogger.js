import chalk from 'chalk';

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


const Logger = ({ logLevel = LOG_VERBOSE }) => {
	const print = (args, printHandler, argFormat) => {
		let printableArgs = [ ...args ];
		if (argFormat) {
			printableArgs = printableArgs.reduce((reduced, arg) => {
				reduced.push(argFormat(arg));
				return reduced;
			}, []);
		}

		printHandler(...printableArgs);
	};

	const Impl = {
		verbose() {
			if (logLevel < Severities[LOG_VERBOSE]) {
				return;
			}

			print(arguments, console.log);
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

			print(arguments, console.info, chalk.bold);
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
