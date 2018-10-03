export type IgnoreMatcher = string[] | RegExp;

export const eventIgnored = (path: string, ignoredEvents?: IgnoreMatcher) => {
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