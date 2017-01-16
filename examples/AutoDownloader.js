'use strict';

// This example script will search the specified items in random order and download
// the best match for each of them


// CONFIG START

// A fixed list of items (found items are not removed...)
const searchItems = [
	{
		query: {
			pattern: 'ubuntu',
			extensions: [ 'iso' ]
		}
		// Use the default download settings
	}, {
		query: {
			pattern: 'cat videos',
			file_type: 'video'
		},
		downloadData: {
			target_directory: '/home/Downloads/Linux/', // Custom location
			priority: 0, // Paused
		}
	},{
		query: {
			pattern: 'Python',
			file_type: 'directory',
		},
		downloadData: {
			target_directory: 'C:\\Downloads\\', // Windows path
			priority: 0, // Paused
		}
	}
];

const intervalMinutes = 5;

// CONFIG END


const ApiSocket = require('../');
const Utils = require('./utils');

const socket = ApiSocket(require('./settings'));


let searchInterval;


socket.onConnected = () => {
	searchInterval = setInterval(searchItem, intervalMinutes * 60 * 1000);

	// Perform an instant search as well
	searchItem();
};

socket.onDisconnected = () => {
	// We can't search without a socket
	clearInterval(searchInterval);
};

const searchItem = async () => {
	// Get a random item to search for
	const pos = Math.floor(Math.random() * searchItems.length);
	const item = searchItems[pos];

	// Create instance
	const instance = await socket.post('search/instances');

	// Add instance-specific listener for results
	socket.addListener('search/instances', 'search_hub_searches_sent', onSearchSent.bind(this, item, instance), instance.id);

	// Perform the actual search
	const searchQueueInfo = await socket.post(`search/instances/${instance.id}/hub_search`, {
		query: item.query
	});

	// Show log message for the user
	socket.post('events', {
		text: `Auto downloader: the item ${item.query.pattern} was searched for from ${searchQueueInfo.sent} hubs`,
		severity: 'info',
	});
};

const onSearchSent = async (item, instance, searchInfo) => {
	// Collect the results for 5 seconds
	await Utils.sleep(5000);

	// Get only the first result (results are sorted by relevance)
	const results = await socket.get(`search/instances/${instance.id}/results/0/1`);

	if (results.length === 0) {
		// Nothing was found
		return;
	}

	// Download the result
	const result = results[0];
	socket.post(`search/instances/${instance.id}/results/${result.id}/download`, item.downloadData);
};

socket.connect();