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
  }

  async sync(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) =>
          key !== 'totalStars' && key !== 'totalXp' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const row = await this.repository.sync(
      gameId,
      platform,
      userId,
      score(body.totalStars),
      cleanPlayerName(body.playerName)
    );
    return {
      totalStars: numberValue(row.total_stars)
    };
  }

  async list(gameId, platform, userId, query) {
    const limit = pageValue(query && query.limit, 20, 1, 100);
    const offset = pageValue(query && query.offset, 0, 0, 1000000);
    const result = await this.repository.list(gameId, platform, userId, limit, offset);
    const entries = result.entries.map((row, index) => entry(row, offset + index + 1, userId));
    const currentUser = result.current ? entry(result.current, result.rank, userId) : null;
    return { entries, currentUser, limit, offset };
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
