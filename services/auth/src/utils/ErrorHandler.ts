export default class ErrorHandler extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);

        this.statusCode = statusCode;
        this.name = 'ErrorHandler';

        // Maintains proper stack trace for where our error was thrown (only available in V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
} 