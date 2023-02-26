"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventIgnored = void 0;
const eventIgnored = (path, ignoredEvents) => {
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
exports.eventIgnored = eventIgnored;
//# sourceMappingURL=utils.js.map