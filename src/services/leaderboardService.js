'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');

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

function entry(row, rank, board, currentUserId) {
  const totalStars = numberValue(row.total_stars);
  const totalXp = numberValue(row.total_xp);
  const userId = String(row.platform_user_id);
  return {
    rank,
    userId,
    playerName: row.player_name || userId,
    avatarUrl: row.avatar_url || '',
    score: board === 'xp' ? totalXp : totalStars,
    totalStars,
    totalXp,
    isCurrentUser: userId === currentUserId
  };
}

class LeaderboardService {
  constructor(repository) {
    this.repository = repository;
  }

  async sync(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'totalStars' && key !== 'totalXp')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const row = await this.repository.sync(
      gameId,
      platform,
      userId,
      score(body.totalStars),
      score(body.totalXp)
    );
    return {
      totalStars: numberValue(row.total_stars),
      totalXp: numberValue(row.total_xp)
    };
  }

  async list(gameId, platform, userId, board, query) {
    const limit = pageValue(query && query.limit, 20, 1, 100);
    const offset = pageValue(query && query.offset, 0, 0, 1000000);
    const result = await this.repository.list(gameId, platform, userId, board, limit, offset);
    const entries = result.entries.map((row, index) => entry(row, offset + index + 1, board, userId));
    const currentUser = result.current ? entry(result.current, result.rank, board, userId) : null;
    return { entries, currentUser, limit, offset };
  }
}

module.exports = { LeaderboardService, score, pageValue, entry };
