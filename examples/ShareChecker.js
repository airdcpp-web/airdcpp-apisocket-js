'use strict';

// This script will search for a list of forbidden items directly from each connecting user
// Forbidden items will be reported privately to the user and also locally as status message

// CONFIG START

const searchItems = [
	{
		query: {
			pattern: 'System32',
			file_type: 'directory',

			// If no match_type is provided, the full path is matched.
			// Exact name match should be used when possible as it will also consume less resources when matching.
			match_type: 'name_exact'
		},
		description: 'Windows directory'
	}, {
		query: {
			extensions: [ 'iso' ],
			min_size: 500*1024*1024
		}, 
		description: 'ISO file(s) over 500 MB'
	}, {
		query: {
			pattern: 'python.exe',
			file_type: 'file',
			match_type: 'name_exact'
		},
		description: 'Python executable'
	}
];

const checkOwnShare = true;
const checkConnectingUsers = true;

// CONFIG END


const ApiSocket = require('../').Socket;
const Utils = require('./utils');

const socket = ApiSocket(require('./settings'));


socket.onConnected = () => {
	if (checkConnectingUsers) {
		socket.addListener('hubs', 'hub_user_connected', onUserConnected);
	}

	if (checkOwnShare) {
		// Check own share on every connect
		searchOwnShare();
	}
};

const onUserConnected = (user) => {
	// Direct search is supported only in ADC hubs
	if (user.flags.indexOf('nmdc') !== -1 || user.flags.indexOf('me') !== -1) {
		return;
	}

	// Perform search for every item
	searchItems.forEach(async (item) => {
		// Get a new instance
		const instance = await socket.post('search');

		// Post the search
		await socket.post(`search/${instance.id}/user_search`, {
			user: user,
			query: item.query
		});

		// Wait for the results to arrive
		await Utils.sleep(5000);

		// Get the best results
		const results = await socket.get(`search/${instance.id}/results/0/10`);

		// Report
		if (results.length > 0) {
			const paths = results.map(result => result.path, []);
			reportUserResults(user, item, paths);
		}

		// Preserve resources
		socket.delete(`search/${instance.id}`);
	});
};

const reportUserResults = (user, item, results) => {
	// Notify the user
	// Forbidden item(s) found from share: ISO file(s) over 500 MB (example: /Linux/Ubuntu 15.04.iso)
	socket.post('private_chat/chat_message', {
		user: user,
		text: `Forbidden item(s) found from share: ${item.description} (${formatResultPaths(results)})`,
	});

	// Show a status message in that particular hub
	// [100]MrFastSpeed: ISO file(s) over 500 MB (/Linux/Ubuntu 15.04.iso)
	socket.post('hubs/status_message', {
		hub_urls: [ user.hub_url ],
		text: `${user.nick}: ${item.description} (${formatResultPaths(results)})`,
		severity: 'info',
	});
};

const searchOwnShare = () => {
	// Perform search for every item
	searchItems.forEach(async (item) => {
		// Share results are returned instantly
		const results = await socket.post('share/search', {
			query: item.query,
			share_profile: undefined // Search from all profiles
		});

		if (results.length > 0) {
			const paths = results.map(result => result.real_paths, []);
			reportShareResults(item, paths);
		}
	});
};

const reportShareResults = (item, results) => {
	// Show an event message
	// Forbidden item found from own share: ISO file(s) over 500 MB (/Linux/Ubuntu 15.04.iso)
	socket.post('events', {
		text: `Forbidden item found from own share: ${item.description} (${formatResultPaths(results)})`,
		severity: 'warning',
	});
};


// UTILS
const formatResultPaths = (paths) => {
	return paths.join(', ');
};

socket.connect();