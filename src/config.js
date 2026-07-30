'use strict';

const PRODUCTS = Object.freeze({
  'crystal-match': Object.freeze({
    coins_10000: Object.freeze({ coins: 10000, okAmount: 5 }),
    coins_25000: Object.freeze({ coins: 25000, okAmount: 10 }),
    coins_60000: Object.freeze({ coins: 60000, okAmount: 20 }),
    coins_150000: Object.freeze({ coins: 150000, okAmount: 45 })
  })
});

function splitOrigins(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function loadConfig(env = process.env) {
  return Object.freeze({
    service: 'archi-games-api',
    version: '1.4.0',
    gameId: env.GAME_ID || 'crystal-match',
    ydbEndpoint: env.YDB_ENDPOINT || '',
    ydbDatabase: env.YDB_DATABASE || '',
    vkAppId: env.VK_APP_ID || '',
    vkAppSecret: env.VK_APP_SECRET || '',
    vkServiceToken: env.VK_SERVICE_TOKEN || '',
    vkApiVersion: env.VK_API_VERSION || '5.199',
    vkCallbackSecret: env.VK_CALLBACK_SECRET || '',
    okAppKey: env.OK_APP_KEY || '',
    okAppSecret: env.OK_APP_SECRET || '',
    allowedOrigins: splitOrigins(env.ALLOWED_ORIGINS),
    nodeEnv: env.NODE_ENV || 'development',
    maxBodyBytes: 64 * 1024,
    products: PRODUCTS
  });
}

module.exports = { loadConfig, PRODUCTS };
