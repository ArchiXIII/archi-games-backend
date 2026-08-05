'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');
const { score, pageValue, cleanPlayerName } = require('./leaderboardService');

function entry(row, rank, currentUserId) {
  const bestScore = numberValue(row.best_score);
  const userId = String(row.platform_user_id);
  return {
    rank,
    userId,
    playerName: row.player_name || userId,
    score: bestScore,
    bestScore,
    isCurrentUser: userId === currentUserId
  };
}

class EndlessLeaderboardService {
  constructor(repository) {
    this.repository = repository;
    this.syncCache = new Map();
    this.listCache = new Map();
    this.syncPromises = new Map();
    this.listPromises = new Map();
    this.cacheLimit = 512;
  }

  setCache(cache, key, value) {
    if (cache.size >= this.cacheLimit && !cache.has(key)) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, value);
  }

  async sync(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'score' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const bestScore = score(body.score);
    const playerName = cleanPlayerName(body.playerName);
    const cacheKey = `${gameId}:${platform}:${userId}`;
    const cached = this.syncCache.get(cacheKey);
    if (cached && cached.bestScore >= bestScore &&
        (!playerName || cached.playerName === playerName)) {
      return { bestScore: cached.bestScore };
    }
    const promiseKey = `${cacheKey}:${bestScore}:${playerName}`;
    if (this.syncPromises.has(promiseKey)) return this.syncPromises.get(promiseKey);
    const promise = this.repository.sync(gameId, platform, userId, bestScore, playerName)
      .then((row) => {
        const storedScore = numberValue(row.best_score);
        this.setCache(this.syncCache, cacheKey, {
          bestScore: storedScore,
          playerName: playerName || (cached && cached.playerName) || ''
        });
        return { bestScore: storedScore };
      }).finally(() => {
        this.syncPromises.delete(promiseKey);
      });
    this.syncPromises.set(promiseKey, promise);
    return promise;
  }

  async list(gameId, platform, userId, query) {
    const limit = pageValue(query && query.limit, 20, 1, 100);
    const offset = pageValue(query && query.offset, 0, 0, 1000000);
    const cacheKey = `${gameId}:${platform}:${limit}:${offset}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return this.personalize(cached.entries, userId, limit, offset);
    if (this.listPromises.has(cacheKey)) {
      return this.listPromises.get(cacheKey)
        .then((entries) => this.personalize(entries, userId, limit, offset));
    }
    const promise = this.repository.list(gameId, platform, limit, offset)
      .then((result) => {
        this.setCache(this.listCache, cacheKey, {
          entries: result.entries,
          expiresAt: Date.now() + 6 * 60 * 60 * 1000
        });
        return result.entries;
      }).finally(() => {
        this.listPromises.delete(cacheKey);
      });
    this.listPromises.set(cacheKey, promise);
    return promise.then((entries) => this.personalize(entries, userId, limit, offset));
  }

  personalize(rows, userId, limit, offset) {
    const entries = rows.map((row, index) => entry(row, offset + index + 1, userId));
    return {
      entries,
      currentUser: entries.find((item) => item.isCurrentUser) || null,
      limit,
      offset
    };
  }
}

module.exports = { EndlessLeaderboardService, entry };
