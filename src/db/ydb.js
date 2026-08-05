'use strict';

const {
  Context,
  Driver,
  MetadataAuthService,
  AnonymousAuthService,
  TypedData
} = require('ydb-sdk');
const { MetadataTokenService } = require('./metadataTokenService');

let driver;
let readyPromise;

function connectionString(config) {
  if (!config.ydbEndpoint || !config.ydbDatabase) {
    throw new Error('YDB_ENDPOINT and YDB_DATABASE are required');
  }
  const endpoint = config.ydbEndpoint.replace(/\/+$/, '').replace(/\?.*$/, '');
  return `${endpoint}${config.ydbDatabase}`;
}

function getDriver(config) {
  if (!driver) {
    const authService = config.nodeEnv === 'test-local'
      ? new AnonymousAuthService()
      : new MetadataAuthService(new MetadataTokenService());
    driver = new Driver({
      connectionString: connectionString(config),
      authService,
      poolSettings: { minLimit: 0, maxLimit: 2 }
    });
  }
  return driver;
}

async function initYdb(config) {
  if (!readyPromise) {
    readyPromise = getDriver(config).ready(1800).then((ready) => {
      if (!ready) throw new Error('YDB driver initialization timed out');
      return driver;
    }).catch((cause) => {
      readyPromise = undefined;
      throw cause;
    });
  }
  return readyPromise;
}

async function withSession(config, callback) {
  const activeDriver = await initYdb(config);
  const context = Context.createNew({ timeout: 2500 });
  try {
    return await activeDriver.tableClient.withSessionRetry(context.ctx, callback, 1200, 1);
  } finally {
    if (context.dispose) context.dispose();
  }
}

function executeCached(session, query, params = {}) {
  return session.executeQuery(query, params, undefined, { keepInCache: true });
}

function rows(result, index = 0) {
  const set = result.resultSets && result.resultSets[index];
  return set ? TypedData.createNativeObjects(set) : [];
}

module.exports = { getDriver, initYdb, withSession, executeCached, rows, connectionString };
