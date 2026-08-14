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
    this.listCache = new Map();
    this.syncPromises = new Map();
    this.listPromises = new Map();
    this.cacheLimit = 512;
  }

  qualifies(rows, userId, bestScore, playerName) {
    const current = rows.find((row) => String(row.platform_user_id) === userId);
    if (current) {
      return bestScore > numberValue(current.best_score) ||
        (!!playerName && playerName !== String(current.player_name || ''));
    }
    if (rows.length < 10) return true;
    const last = rows[9];
    const lastScore = numberValue(last.best_score);
    return bestScore > lastScore ||
      (bestScore === lastScore && userId < String(last.platform_user_id));
  }

  invalidateListCache(gameId, platform) {
    const prefix = `${gameId}:${platform}:`;
    for (const key of this.listCache.keys()) {
      if (key.startsWith(prefix)) this.listCache.delete(key);
    }
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
    const promiseKey = `${gameId}:${platform}:${userId}:${bestScore}:${playerName}`;
    if (this.syncPromises.has(promiseKey)) return this.syncPromises.get(promiseKey);
    const promise = this.syncTop(gameId, platform, userId, bestScore, playerName).finally(() => {
        this.syncPromises.delete(promiseKey);
      });
    this.syncPromises.set(promiseKey, promise);
    return promise;
  }

  async syncTop(gameId, platform, userId, bestScore, playerName) {
    const before = (await this.repository.list(gameId, platform, 10, 0)).entries;
    if (!this.qualifies(before, userId, bestScore, playerName)) {
      return {
        bestScore,
        qualified: before.some((row) => String(row.platform_user_id) === userId),
        ...this.personalize(before, userId, 10, 0)
      };
    }
    await this.repository.sync(gameId, platform, userId, bestScore, playerName);
    const ranked = (await this.repository.list(gameId, platform, 100, 0)).entries;
    const overflow = ranked.slice(10);
    for (const row of overflow) {
      await this.repository.remove(gameId, platform, String(row.platform_user_id));
    }
    const top = ranked.slice(0, 10);
    this.invalidateListCache(gameId, platform);
    this.setCache(this.listCache, `${gameId}:${platform}:10:0`, {
      entries: top,
      expiresAt: Date.now() + 6 * 60 * 60 * 1000
    });
    const current = top.find((row) => String(row.platform_user_id) === userId);
    return {
      bestScore: current ? numberValue(current.best_score) : bestScore,
      qualified: !!current,
      ...this.personalize(top, userId, 10, 0)
    };
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
