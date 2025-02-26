import waitForExpectOriginal from 'wait-for-expect';

const EXCEPT_TIMEOUT = 1000;
//@ts-ignore
export const waitForExpect = (func: () => void | Promise<void>) => waitForExpectOriginal.default(func, EXCEPT_TIMEOUT);


// This is a helper function that will suppress the error of a promise.
export const defusedPromise = (promise: Promise<any>) => {
  promise.catch(() => {});
  return promise;
}

export const getMockConsole = (verbose = false) => ({
  log: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    if (verbose) {
      console.log(a1, a2, a3, a4);
    }
  }),
  info: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    if (verbose) {
      console.info(a1, a2, a3, a4);
    }
  }),
  warn: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.warn(a1, a2, a3, a4);
  }),
  error: jest.fn((a1: any, a2: any, a3: any, a4: any) => {
    console.error(a1, a2, a3, a4);
  }),
});
