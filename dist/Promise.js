"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Use native promises when available
let AppPromise;
if (typeof Promise !== 'undefined') {
    AppPromise = Promise;
}
else {
    AppPromise = require('promise');
}
function pending() {
    let resolve, reject;
    let promise = new AppPromise(function () {
        resolve = arguments[0];
        reject = arguments[1];
    });
    return {
        resolve: resolve,
        reject: reject,
        promise
    };
}
const PendingPromise = Object.assign(AppPromise, {
    pending
});
exports.default = PendingPromise;
//# sourceMappingURL=Promise.js.map