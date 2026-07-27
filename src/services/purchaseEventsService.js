'use strict';

const { HttpError } = require('../response');

const EVENT_ID = /^(grant|refund)_[a-f0-9]{64}$/;

class PurchaseEventsService {
  constructor(repository) {
    this.repository = repository;
  }

  pending(gameId, platform, userId) {
    return this.repository.pending(gameId, platform, userId);
  }

  async ack(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'eventId') ||
        !EVENT_ID.test(body.eventId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    await this.repository.ack(gameId, platform, userId, body.eventId);
    return body.eventId;
  }
}

module.exports = { PurchaseEventsService, EVENT_ID };
