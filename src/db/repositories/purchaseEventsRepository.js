'use strict';

const { TypedValues } = require('ydb-sdk');
const { withSession } = require('../ydb');

class PurchaseEventsRepository {
  constructor(config) {
    this.config = config;
  }

  async add(event) {
    return withSession(this.config, (session) => session.executeQuery(`
      DECLARE $event_id AS Utf8;
      DECLARE $platform AS Utf8;
      DECLARE $order_id AS Utf8;
      DECLARE $event_type AS Utf8;
      DECLARE $payload AS Json;
      UPSERT INTO purchase_events
        (event_id, platform, platform_order_id, event_type, payload_json, created_at)
      VALUES ($event_id, $platform, $order_id, $event_type, $payload, CurrentUtcTimestamp());
    `, {
      $event_id: TypedValues.utf8(event.eventId),
      $platform: TypedValues.utf8(event.platform),
      $order_id: TypedValues.utf8(event.orderId),
      $event_type: TypedValues.utf8(event.type),
      $payload: TypedValues.json(JSON.stringify(event.payload))
    }));
  }
}

module.exports = { PurchaseEventsRepository };
