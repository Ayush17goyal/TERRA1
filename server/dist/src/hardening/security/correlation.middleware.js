"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRELATION_HEADER = void 0;
exports.correlationMiddleware = correlationMiddleware;
const crypto_1 = require("crypto");
exports.CORRELATION_HEADER = 'x-correlation-id';
function correlationMiddleware(req, res, next) {
    const inbound = req.header(exports.CORRELATION_HEADER);
    const correlationId = inbound && /^[a-zA-Z0-9._:-]{8,128}$/.test(inbound) ? inbound : (0, crypto_1.randomUUID)();
    req.correlationId = correlationId;
    res.setHeader(exports.CORRELATION_HEADER, correlationId);
    next();
}
//# sourceMappingURL=correlation.middleware.js.map