export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode = 500, public readonly safeMessage = 'Something went wrong. Please try again.', public readonly retryable = false) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class DependencyUnavailableError extends AppError { constructor(dependency: string, message = `${dependency} is unavailable`) { super(message, 'DEPENDENCY_UNAVAILABLE', 503, 'A required service is temporarily unavailable. Please retry shortly.', true); } }
export class SecurityPolicyError extends AppError { constructor(message: string, safeMessage = 'This request could not be accepted for security reasons.') { super(message, 'SECURITY_POLICY_VIOLATION', 400, safeMessage, false); } }
export class ConfigurationError extends AppError { constructor(message: string) { super(message, 'CONFIGURATION_ERROR', 500, 'The service is not configured correctly.', false); } }