'use strict';

const { loadConfig } = require('./src/config');
const { getDriver } = require('./src/db/ydb');
const { PlayersRepository } = require('./src/db/repositories/playersRepository');
const { OrdersRepository } = require('./src/db/repositories/ordersRepository');
const { ProductsService } = require('./src/services/productsService');
const { BalanceService } = require('./src/services/balanceService');
const { PurchaseService } = require('./src/services/purchaseService');
const { createRouter } = require('./src/router');

const config = loadConfig();
const playersRepository = new PlayersRepository(config);
const ordersRepository = new OrdersRepository(config);
const productsService = new ProductsService(config.products);
const balanceService = new BalanceService(playersRepository);
const purchaseService = new PurchaseService(productsService, ordersRepository);

if (config.ydbEndpoint && config.ydbDatabase) getDriver(config);

const handler = createRouter({
  config,
  balanceService,
  purchaseService
});

module.exports = { handler };
