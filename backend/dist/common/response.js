"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, message = 'Operation successful', statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
}
function sendError(res, message, statusCode = 400, details) {
    return res.status(statusCode).json({
        success: false,
        message,
        error: message,
        data: details || null,
        timestamp: new Date().toISOString(),
    });
}
