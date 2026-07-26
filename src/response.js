'use strict';

class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function json(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    },
    body: JSON.stringify(payload)
  };
}

function error(statusCode, code, message, headers) {
  return json(statusCode, { ok: false, error: { code, message } }, headers);
}

module.exports = { HttpError, json, error };
