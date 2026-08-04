'use strict';

const { HttpError } = require('../response');

const EVENT_ID = /^(grant|refund)_[a-f0-9]{64}$/;

class PurchaseEventsService {
  constructor(repository) {
    this.repository = repository;
    this.emptyCache = new Map();
    this.pendingPromises = new Map();
    this.cacheLimit = 512;
  }

  async pending(gameId, platform, userId) {
    const key = `${gameId}:${platform}:${userId}`;
    const cachedUntil = this.emptyCache.get(key) || 0;
    if (Date.now() < cachedUntil) return [];
    if (this.pendingPromises.has(key)) return this.pendingPromises.get(key);
    const promise = this.repository.pending(gameId, platform, userId)
      .then((events) => {
        if (events.length) {
          this.emptyCache.delete(key);
        } else {
          if (this.emptyCache.size >= this.cacheLimit && !this.emptyCache.has(key)) {
            this.emptyCache.delete(this.emptyCache.keys().next().value);
          }
          this.emptyCache.set(key, Date.now() + 3000);
        }
        return events;
      }).finally(() => {
        this.pendingPromises.delete(key);
      });
    this.pendingPromises.set(key, promise);
    return promise;
  }

  async ack(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'eventId') ||
        !EVENT_ID.test(body.eventId || '')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    await this.repository.ack(gameId, platform, userId, body.eventId);
    this.emptyCache.delete(`${gameId}:${platform}:${userId}`);
    return body.eventId;
  }
}

module.exports = { PurchaseEventsService, EVENT_ID };
