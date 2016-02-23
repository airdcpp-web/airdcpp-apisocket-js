'use strict';

// This example script will search through a list of items and download
// the best match for each of them


// CONFIG START

// A fixed list of items (found items are not removed...)
const searchItems = [
	{
		query: {
			pattern: 'cat videos',
			file_type: 'video'
		},
		downloadData: {
			target: '/home/videos/',
		}
	}, {
		query: {
			pattern: 'ubuntu',
			extensions: [ 'iso' ]
		}, 
		downloadData: {
			target: null, // The default download directory will be used
			priority: 0, // Paused
		}
	}, {
		query: {
			pattern: 'NVIDIA',
			file_type: 'directory',
		},
		downloadData: {
			target: 'E:\\Downloads\\',
			priority: 0, // Paused
		}
	}
];

const intervalMinutes = 5;

// CONFIG END


const ApiSocket = require('../');

const socket = ApiSocket(require('./settings'));


let searchInterval;
let resultTimeout;

const onResultsReceived = (item, results) => {
	if (results.length === 0) {
		// Nothing was found
		return;
	}

	// Download the result
	const result = results[0];
	socket.post('search/v0/result/' + result.id + '/download', item.downloadData);
};

const onSearchSent = (item, data) => {
	socket.post('events/v0/message', {
		text: 'Auto downloader: the item ' + item.query.pattern + ' was searched for from ' + data.sent + ' hubs',
		severity: 'info',
	});

	resultTimeout = setTimeout(() => {
		// Only get the first result (results are sorted by relevancy)
		socket.get('search/v0/results/0/1')
			.then(onResultsReceived.bind(this, item));

	}, data.queue_time + 5000); // Collect the results for 5 seconds after the search was sent
};

const search = () => {
	// Get a random item to search for
	const pos = Math.floor(Math.random() * searchItems.length);
	const item = searchItems[pos];

	// Perform search
	socket.post('search/v0/query', {
		query: item.query
	})
		.then(onSearchSent.bind(this, item));
};

socket.onConnected = () => {
	searchInterval = setInterval(search, intervalMinutes * 60 * 1000);

	// Perform an instant search as well
	search();
};

socket.onDisconnected = () => {
	// We can't search or download without a socket
	clearInterval(searchInterval);
	clearTimeout(resultTimeout);
};

socket.connect();