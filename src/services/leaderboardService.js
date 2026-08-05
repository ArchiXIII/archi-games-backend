'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');

const PLAYER_NAME_LIMIT = 80;
const PLAYER_NAME_RAW_LIMIT = 512;
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;

function score(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  return value;
}

function pageValue(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  return parsed;
}

function cleanPlayerName(value) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > PLAYER_NAME_RAW_LIMIT) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
  }
  const cleaned = value
    .normalize('NFKC')
    .replace(UNSAFE_NAME_CHARACTERS, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const characters = Array.from(cleaned);
  return characters.length > PLAYER_NAME_LIMIT
    ? characters.slice(0, PLAYER_NAME_LIMIT).join('')
    : cleaned;
}

function entry(row, rank, currentUserId) {
  const totalStars = numberValue(row.total_stars);
  const userId = String(row.platform_user_id);
  return {
    rank,
    userId,
    playerName: row.player_name || userId,
    score: totalStars,
    totalStars,
    isCurrentUser: userId === currentUserId
  };
}

class LeaderboardService {
  constructor(repository) {
    this.repository = repository;
    this.listCache = new Map();
    this.syncPromises = new Map();
    this.listPromises = new Map();
    this.cacheLimit = 512;
  }

  qualifies(rows, userId, totalStars, playerName) {
    const current = rows.find((row) => String(row.platform_user_id) === userId);
    if (current) {
      return totalStars > numberValue(current.total_stars) ||
        (!!playerName && playerName !== String(current.player_name || ''));
    }
    if (rows.length < 10) return true;
    const last = rows[9];
    const lastScore = numberValue(last.total_stars);
    return totalStars > lastScore ||
      (totalStars === lastScore && userId < String(last.platform_user_id));
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
        Object.keys(body).some((key) =>
          key !== 'totalStars' && key !== 'totalXp' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const totalStars = score(body.totalStars);
    const playerName = cleanPlayerName(body.playerName);
    const promiseKey = `${gameId}:${platform}:${userId}:${totalStars}:${playerName}`;
    if (this.syncPromises.has(promiseKey)) return this.syncPromises.get(promiseKey);
    const promise = this.syncTop(gameId, platform, userId, totalStars, playerName).finally(() => {
      this.syncPromises.delete(promiseKey);
    });
    this.syncPromises.set(promiseKey, promise);
    return promise;
  }

  async syncTop(gameId, platform, userId, totalStars, playerName) {
    const before = (await this.repository.list(gameId, platform, 10, 0)).entries;
    if (!this.qualifies(before, userId, totalStars, playerName)) {
      return {
        totalStars,
        qualified: before.some((row) => String(row.platform_user_id) === userId),
        ...this.personalize(before, userId, 10, 0)
      };
    }
    await this.repository.sync(gameId, platform, userId, totalStars, playerName);
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
    return {
      totalStars,
      qualified: top.some((row) => String(row.platform_user_id) === userId),
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

module.exports = {
  LeaderboardService,
  score,
  pageValue,
  entry,
  cleanPlayerName,
  PLAYER_NAME_LIMIT
};
