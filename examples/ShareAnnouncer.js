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


socket.onConnected = () => {
	// Add listeners
	if (announceHashed) {
		socket.addListener('hash', 'hasher_directory_finished', onDirectoryHashed);
	}

	if (announceBundles) {
		socket.addListener('queue', 'queue_bundle_status', onBundleStatusChanged);
	}
};

const onDirectoryShared = (name, size) => {
	// Send a chat message to specified hubs
	socket.post('hubs/chat_message', {
		hub_urls: hubUrls,
		text: `The directory ${name} (${Utils.formatSize(size)}) was added in share`,
	});
};

const onBundleStatusChanged = (bundle) => {
	if (bundle.status.id !== 'shared') {
		return;
	}

	if (bundle.type.id === 'file') {
		return;
	}

	onDirectoryShared(bundle.name, bundle.size);
};

const onDirectoryHashed = (directoryInfo) => {
	onDirectoryShared(Utils.getLastDirectory(directoryInfo.path), directoryInfo.size);
};

socket.connect();