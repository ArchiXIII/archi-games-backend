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
    avatarUrl: row.avatar_url || '',
    score: totalStars,
    totalStars,
    isCurrentUser: userId === currentUserId
  };
}

class LeaderboardService {
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
        Object.keys(body).some((key) =>
          key !== 'totalStars' && key !== 'totalXp' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const totalStars = score(body.totalStars);
    const playerName = cleanPlayerName(body.playerName);
    const cacheKey = `${gameId}:${platform}:${userId}`;
    const cached = this.syncCache.get(cacheKey);
    if (cached && cached.totalStars >= totalStars &&
        (!playerName || cached.playerName === playerName)) {
      return { totalStars: cached.totalStars };
    }
    const promiseKey = `${cacheKey}:${totalStars}:${playerName}`;
    if (this.syncPromises.has(promiseKey)) return this.syncPromises.get(promiseKey);
    const promise = this.repository.sync(
      gameId,
      platform,
      userId,
      totalStars,
      playerName
    ).then((row) => {
      const storedStars = numberValue(row.total_stars);
      this.setCache(this.syncCache, cacheKey, {
        totalStars: storedStars,
        playerName: playerName || (cached && cached.playerName) || ''
      });
      this.listCache.clear();
      return { totalStars: storedStars };
    }).finally(() => {
      this.syncPromises.delete(promiseKey);
    });
    this.syncPromises.set(promiseKey, promise);
    return promise;
  }

  async list(gameId, platform, userId, query) {
    const limit = pageValue(query && query.limit, 20, 1, 100);
    const offset = pageValue(query && query.offset, 0, 0, 1000000);
    const cacheKey = `${gameId}:${platform}:${userId}:${limit}:${offset}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.value;
    if (this.listPromises.has(cacheKey)) return this.listPromises.get(cacheKey);
    const promise = this.repository.list(gameId, platform, userId, limit, offset)
      .then((result) => {
        const entries = result.entries.map((row, index) => entry(row, offset + index + 1, userId));
        const currentUser = result.current ? entry(result.current, result.rank, userId) : null;
        const value = { entries, currentUser, limit, offset };
        this.setCache(this.listCache, cacheKey, { value, expiresAt: Date.now() + 60000 });
        return value;
      }).finally(() => {
        this.listPromises.delete(cacheKey);
      });
    this.listPromises.set(cacheKey, promise);
    return promise;
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
