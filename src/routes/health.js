'use strict';

const { json } = require('../response');

function healthRoute(context) {
  return json(200, {
    ok: true,
    service: context.config.service,
    version: context.config.version,
    timestamp: new Date().toISOString()
  });
}

module.exports = { healthRoute };
