import * as Options from './types/options.js';


export const eventIgnored = (path: string, ignoredEvents?: Options.IgnoreMatcher) => {
  if (!ignoredEvents) {
    return false;
  }

  // Array?
  if (Array.isArray(ignoredEvents)) {
    return ignoredEvents.includes(path);
  }

  // Regexp
  return ignoredEvents.test(path);
};