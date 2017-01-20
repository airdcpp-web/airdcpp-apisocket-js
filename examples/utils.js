'use strict';

const byteUnits = [ 'kB','MB','GB','TB','PB','EB','ZB','YB' ];

module.exports = {
	formatSize: function (fileSizeInBytes) {
		const thresh = 1024;
		if (Math.abs(fileSizeInBytes) < thresh) {
			return fileSizeInBytes + ' B';
		}

		let u = -1;
		do {
			fileSizeInBytes /= thresh;
			++u;
		} while (Math.abs(fileSizeInBytes) >= thresh && u < byteUnits.length - 1);

		return fileSizeInBytes.toFixed(2) + ' ' + byteUnits[u];
	},

	// Works only for directories
	getLastDirectory: function (fullPath) {
		const result = fullPath.match(/([^\\\/]+)[\\\/]$/);
		return result ? result[1] : fullPath;
	},

	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
};