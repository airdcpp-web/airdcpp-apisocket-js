'use strict';

// This script will announce hashed directories and finished bundles in connected hubs


// CONFIG START

// Announce in all connected hubs by default
let hubUrls = undefined;

// Uncomment the following lines if you want to announce the items in specific hubs only
// hubUrls = [
//	 'adcs://192.168.0.100:2780'
// ];

// Announce hashed directories
// Limitations: 
// - it will announce the directory every time when new files are hashed into it
// - when multiple per-volume hashers are used and hashing the same directory, there will be a separate announcement for each of them
// A cache of already announced directories could be implemented to avoid such issues
const announceHashed = true;

// Announce finished bundles when they are added in share
const announceBundles = true;

// CONFIG END


const ApiSocket = require('../');
const Utils = require('./utils');

const socket = ApiSocket(require('./settings'));


const onDirectoryShared = (name, size) => {
	// Send a chat message to wanted hubs
	socket.post('hubs/v0/message', {
		hub_urls: hubUrls,
		text: 'The directory ' + name + ' (' + Utils.formatSize(size) + ') was added in share',
	});
};

const onBundleStatusChanged = (bundle) => {
	if (bundle.status.id !== 'shared') {
		return;
	}

	onDirectoryShared(bundle.name, bundle.size);
};

const onDirectoryHashed = (directoryInfo) => {
	onDirectoryShared(Utils.getLastDirectory(directoryInfo.path), directoryInfo.size);
};

socket.onConnected = () => {
	if (announceHashed) {
		socket.addSocketListener('hash/v0', 'hasher_directory_finished', onDirectoryHashed);
	}

	if (announceBundles) {
		socket.addSocketListener('queue/v0', 'bundle_status', onBundleStatusChanged);
	}
};

socket.connect();