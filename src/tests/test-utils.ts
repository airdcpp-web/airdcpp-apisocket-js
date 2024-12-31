import waitForExpectOriginal from 'wait-for-expect';

const EXCEPT_TIMEOUT = 1000;
//@ts-ignore
export const waitForExpect = (func: () => void | Promise<void>) => waitForExpectOriginal.default(func, EXCEPT_TIMEOUT);