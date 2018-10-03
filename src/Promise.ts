// Use native promises when available
let AppPromise: PromiseConstructor;
if (typeof Promise !== 'undefined') {
  AppPromise = Promise;
} else {
  AppPromise = require('promise');
}


export interface PendingResult extends Pick<PromiseConstructor, 'resolve' | 'reject'> {
  promise: Promise<any>;
}

function pending(): PendingResult {
  let resolve: typeof Promise['resolve'], reject: typeof Promise['reject'];
  let promise = new AppPromise(function () {
    resolve = arguments[0];
    reject = arguments[1];
  });

  return {
    resolve: resolve!,
    reject: reject!,
    promise
  };
}

export interface AppPromise extends PromiseConstructor {
  pending: () => PendingResult;
}

const PendingPromise: AppPromise = Object.assign(
  AppPromise, 
  {
    pending
  }
);

export default PendingPromise;