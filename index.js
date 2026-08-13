'use strict';

const { loadConfig } = require('./src/config');
const { getDriver } = require('./src/db/ydb');
const { LeaderboardRepository } = require('./src/db/repositories/leaderboardRepository');
const { OrdersRepository } = require('./src/db/repositories/ordersRepository');
const { PurchaseEventsRepository } = require('./src/db/repositories/purchaseEventsRepository');
const { EndlessLeaderboardRepository } = require('./src/db/repositories/endlessLeaderboardRepository');
const { JorOkEndlessRepository } = require('./src/db/repositories/jorOkEndlessRepository');
const { ProductsService } = require('./src/services/productsService');
const { LeaderboardService } = require('./src/services/leaderboardService');
const { PurchaseService } = require('./src/services/purchaseService');
const { PurchaseEventsService } = require('./src/services/purchaseEventsService');
const { VkApiService } = require('./src/services/vkApiService');
const { OkPaymentsService } = require('./src/services/okPaymentsService');
const { VkPaymentsService } = require('./src/services/vkPaymentsService');
const { EndlessLeaderboardService } = require('./src/services/endlessLeaderboardService');
const { JorOkEndlessService } = require('./src/services/jorOkEndlessService');
const { createRouter } = require('./src/router');

const config = loadConfig();
const leaderboardRepository = new LeaderboardRepository(config);
const ordersRepository = new OrdersRepository(config);
const purchaseEventsRepository = new PurchaseEventsRepository(config);
const endlessLeaderboardRepository = new EndlessLeaderboardRepository(config);
const jorOkEndlessRepository = new JorOkEndlessRepository(config);
const productsService = new ProductsService(config.products);
const leaderboardService = new LeaderboardService(leaderboardRepository);
const purchaseService = new PurchaseService(productsService, ordersRepository);
const purchaseEventsService = new PurchaseEventsService(purchaseEventsRepository);
const vkApiService = new VkApiService(config);
const okPaymentsService = new OkPaymentsService(config, purchaseService);
const vkPaymentsService = new VkPaymentsService(config, productsService, purchaseService);
const endlessLeaderboardService = new EndlessLeaderboardService(endlessLeaderboardRepository);
const jorOkEndlessService = new JorOkEndlessService(jorOkEndlessRepository);
const jorVkApiService = new VkApiService({
  vkServiceToken: config.jorVkServiceToken,
  vkApiVersion: config.vkApiVersion
});

if (config.ydbEndpoint && config.ydbDatabase) getDriver(config);

const handler = createRouter({
  config,
  leaderboardService,
  purchaseService,
  purchaseEventsService,
  vkApiService,
  vkPaymentsService,
  okPaymentsService,
  endlessLeaderboardService,
  jorOkEndlessService,
  jorVkApiService
});

module.exports = { handler };
