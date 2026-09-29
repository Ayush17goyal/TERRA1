"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationError = exports.SecurityPolicyError = exports.DependencyUnavailableError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, code, statusCode = 500, safeMessage = 'Something went wrong. Please try again.', retryable = false) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.safeMessage = safeMessage;
        this.retryable = retryable;
        this.name = this.constructor.name;
    }
}
exports.AppError = AppError;
class DependencyUnavailableError extends AppError {
    constructor(dependency, message = `${dependency} is unavailable`) { super(message, 'DEPENDENCY_UNAVAILABLE', 503, 'A required service is temporarily unavailable. Please retry shortly.', true); }
}
exports.DependencyUnavailableError = DependencyUnavailableError;
class SecurityPolicyError extends AppError {
    constructor(message, safeMessage = 'This request could not be accepted for security reasons.') { super(message, 'SECURITY_POLICY_VIOLATION', 400, safeMessage, false); }
}
exports.SecurityPolicyError = SecurityPolicyError;
class ConfigurationError extends AppError {
    constructor(message) { super(message, 'CONFIGURATION_ERROR', 500, 'The service is not configured correctly.', false); }
}
exports.ConfigurationError = ConfigurationError;
//# sourceMappingURL=app-errors.js.map