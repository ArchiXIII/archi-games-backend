'use strict';

const { JOR_PRODUCTS } = require('./config/jorProducts');

const PRODUCTS = Object.freeze({
  'crystal-match': Object.freeze({
    coins_10000: Object.freeze({ coins: 10000, vkVotes: 5, okAmount: 19, title: '10 000 монет' }),
    coins_25000: Object.freeze({ coins: 25000, vkVotes: 10, okAmount: 49, title: '25 000 монет' }),
    coins_60000: Object.freeze({ coins: 60000, vkVotes: 20, okAmount: 99, title: '60 000 монет' }),
    coins_150000: Object.freeze({ coins: 150000, vkVotes: 45, okAmount: 199, title: '150 000 монет' })
  })
});

function splitOrigins(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function loadConfig(env = process.env) {
  return Object.freeze({
    service: 'archi-games-api',
    version: '1.6.0',
    gameId: env.GAME_ID || 'crystal-match',
    ydbEndpoint: env.YDB_ENDPOINT || '',
    ydbDatabase: env.YDB_DATABASE || '',
    vkAppId: env.VK_APP_ID || '',
    vkAppSecret: env.VK_APP_SECRET || '',
    vkServiceToken: env.VK_SERVICE_TOKEN || '',
    vkApiVersion: env.VK_API_VERSION || '5.199',
    vkCallbackSecret: env.VK_CALLBACK_SECRET || '',
    jorVkAppId: env.JOR_VK_APP_ID || '',
    jorVkAppSecret: env.JOR_VK_APP_SECRET || '',
    jorVkServiceToken: env.JOR_VK_SERVICE_TOKEN || '',
    okVkAppId: env.OK_VK_APP_ID || '',
    okVkAppSecret: env.OK_VK_APP_SECRET || '',
    okAppId: env.OK_APP_ID || '',
    okAppKey: env.OK_APP_KEY || '',
    okAppSecret: env.OK_APP_SECRET || '',
    jorOkAppId: env.JOR_OK_APP_ID || '',
    jorOkAppKey: env.JOR_OK_APP_KEY || '',
    allowedOrigins: splitOrigins(env.ALLOWED_ORIGINS),
    nodeEnv: env.NODE_ENV || 'development',
    maxBodyBytes: 64 * 1024,
    minClientVersion: Math.max(1, Math.floor(Number(env.MIN_CLIENT_VERSION) || 2)),
    products: PRODUCTS,
    jorProducts: JOR_PRODUCTS
  });
}

module.exports = { loadConfig, PRODUCTS, JOR_PRODUCTS };
