// Use native promises when available
let AppPromise;
if (typeof Promise !== 'undefined') {
	AppPromise = Promise;
} else {
	AppPromise = require('promise');
}

function pending() {
	let resolve, reject;
	let promise = new AppPromise(function () {
		resolve = arguments[0];
		reject = arguments[1];
	});

	return {
		resolve,
		reject,
		promise
	};
}

export default Object.assign(AppPromise, {
	pending
});
