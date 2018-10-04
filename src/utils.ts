import * as Options from './types/options';


export const eventIgnored = (path: string, ignoredEvents?: Options.IgnoreMatcher) => {
  if (!ignoredEvents) {
    return false;
  }

  // Array?
  if (Array.isArray(ignoredEvents)) {
    return ignoredEvents.indexOf(path) !== -1;
  }

  // Regexp
  return ignoredEvents.test(path);
};