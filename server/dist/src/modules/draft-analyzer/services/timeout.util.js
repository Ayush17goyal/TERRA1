"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = void 0;
exports.withTimeout = withTimeout;
class TimeoutError extends Error {
    constructor(stage, limitMs) {
        super(`Stage "${stage}" timed out after ${limitMs} ms`);
        this.stage = stage;
        this.limitMs = limitMs;
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
function withTimeout(promise, ms, stage) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new TimeoutError(stage, ms)), ms);
        promise
            .then(v => { clearTimeout(timer); resolve(v); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}
//# sourceMappingURL=timeout.util.js.map