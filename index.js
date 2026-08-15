'use strict';

const { loadConfig } = require('./src/config');
const { getDriver } = require('./src/db/ydb');
const { LeaderboardRepository } = require('./src/db/repositories/leaderboardRepository');
const { OrdersRepository } = require('./src/db/repositories/ordersRepository');
const { PurchaseEventsRepository } = require('./src/db/repositories/purchaseEventsRepository');
const { EndlessLeaderboardRepository } = require('./src/db/repositories/endlessLeaderboardRepository');
const { JorOkEndlessRepository } = require('./src/db/repositories/jorOkEndlessRepository');
const { JorPurchasesRepository } = require('./src/db/repositories/jorPurchasesRepository');
const { ProductsService } = require('./src/services/productsService');
const { LeaderboardService } = require('./src/services/leaderboardService');
const { PurchaseService } = require('./src/services/purchaseService');
const { PurchaseEventsService } = require('./src/services/purchaseEventsService');
const { VkApiService } = require('./src/services/vkApiService');
const { OkPaymentsService } = require('./src/services/okPaymentsService');
const { VkPaymentsService } = require('./src/services/vkPaymentsService');
const { EndlessLeaderboardService } = require('./src/services/endlessLeaderboardService');
const { JorOkEndlessService } = require('./src/services/jorOkEndlessService');
const { JorPurchasesService } = require('./src/services/jorPurchasesService');
const { JorVkPaymentsService } = require('./src/services/jorVkPaymentsService');
const { JorOkPaymentsService } = require('./src/services/jorOkPaymentsService');
const { createRouter } = require('./src/router');

const config = loadConfig();
const leaderboardRepository = new LeaderboardRepository(config);
const ordersRepository = new OrdersRepository(config);
const purchaseEventsRepository = new PurchaseEventsRepository(config);
const endlessLeaderboardRepository = new EndlessLeaderboardRepository(config);
const jorOkEndlessRepository = new JorOkEndlessRepository(config);
const jorPurchasesRepository = new JorPurchasesRepository(config);
const productsService = new ProductsService(config.products);
const leaderboardService = new LeaderboardService(leaderboardRepository);
const purchaseService = new PurchaseService(productsService, ordersRepository);
const purchaseEventsService = new PurchaseEventsService(purchaseEventsRepository);
const vkApiService = new VkApiService(config);
const okPaymentsService = new OkPaymentsService(config, purchaseService);
const vkPaymentsService = new VkPaymentsService(config, productsService, purchaseService);
const endlessLeaderboardService = new EndlessLeaderboardService(endlessLeaderboardRepository);
const jorOkEndlessService = new JorOkEndlessService(jorOkEndlessRepository);
const jorPurchasesService = new JorPurchasesService(config.jorProducts, jorPurchasesRepository);
const jorVkPaymentsService = new JorVkPaymentsService(config, config.jorProducts, jorPurchasesService);
const jorOkPaymentsService = new JorOkPaymentsService(config, config.jorProducts, jorPurchasesService);
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
  jorVkApiService,
  jorPurchasesService,
  jorVkPaymentsService,
  jorOkPaymentsService
});

module.exports = { handler };
