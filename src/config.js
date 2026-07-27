'use strict';

const PRODUCTS = Object.freeze({
  'crystal-match': Object.freeze({
    coins_10000: Object.freeze({ coins: 10000 }),
    coins_25000: Object.freeze({ coins: 25000 }),
    coins_60000: Object.freeze({ coins: 60000 }),
    coins_150000: Object.freeze({ coins: 150000 })
  })
});

function splitOrigins(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function loadConfig(env = process.env) {
  return Object.freeze({
    service: 'archi-games-api',
    version: '1.1.1',
    gameId: 'crystal-match',
    platform: 'vk',
    ydbEndpoint: env.YDB_ENDPOINT || '',
    ydbDatabase: env.YDB_DATABASE || '',
    vkAppId: env.VK_APP_ID || '',
    vkAppSecret: env.VK_APP_SECRET || '',
    vkCallbackSecret: env.VK_CALLBACK_SECRET || '',
    allowedOrigins: splitOrigins(env.ALLOWED_ORIGINS),
    nodeEnv: env.NODE_ENV || 'development',
    maxBodyBytes: 64 * 1024,
    products: PRODUCTS
  });
}

module.exports = { loadConfig, PRODUCTS };
