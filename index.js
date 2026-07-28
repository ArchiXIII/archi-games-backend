'use strict';

const { loadConfig } = require('./src/config');
const { getDriver } = require('./src/db/ydb');
const { LeaderboardRepository } = require('./src/db/repositories/leaderboardRepository');
const { OrdersRepository } = require('./src/db/repositories/ordersRepository');
const { PurchaseEventsRepository } = require('./src/db/repositories/purchaseEventsRepository');
const { ProductsService } = require('./src/services/productsService');
const { LeaderboardService } = require('./src/services/leaderboardService');
const { PurchaseService } = require('./src/services/purchaseService');
const { PurchaseEventsService } = require('./src/services/purchaseEventsService');
const { VkApiService } = require('./src/services/vkApiService');
const { createRouter } = require('./src/router');

const config = loadConfig();
const leaderboardRepository = new LeaderboardRepository(config);
const ordersRepository = new OrdersRepository(config);
const purchaseEventsRepository = new PurchaseEventsRepository(config);
const productsService = new ProductsService(config.products);
const leaderboardService = new LeaderboardService(leaderboardRepository);
const purchaseService = new PurchaseService(productsService, ordersRepository);
const purchaseEventsService = new PurchaseEventsService(purchaseEventsRepository);
const vkApiService = new VkApiService(config);

if (config.ydbEndpoint && config.ydbDatabase) getDriver(config);

const handler = createRouter({
  config,
  leaderboardService,
  purchaseService,
  purchaseEventsService,
  vkApiService
});

module.exports = { handler };
