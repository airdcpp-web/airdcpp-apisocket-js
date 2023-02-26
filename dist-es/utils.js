export const eventIgnored = (path, ignoredEvents) => {
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
//# sourceMappingURL=utils.js.map