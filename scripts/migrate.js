'use strict';

const { loadConfig } = require('../src/config');
const { runMigrations } = require('../src/db/migrations');

runMigrations(loadConfig())
  .then((files) => {
    console.log(`Applied migrations: ${files.join(', ')}`);
    process.exitCode = 0;
  })
  .catch((cause) => {
    console.error(cause && cause.message || cause);
    process.exitCode = 1;
  });
