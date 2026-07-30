'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');
const { score, pageValue, cleanPlayerName } = require('./leaderboardService');

function timestamp(value) {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function entry(row, rank, currentUserId) {
  const bestScore = numberValue(row.best_score);
  const userId = String(row.platform_user_id);
  return {
    rank,
    userId,
    playerName: row.player_name || userId,
    score: bestScore,
    bestScore,
    updatedAt: timestamp(row.updated_at),
    isCurrentUser: userId === currentUserId
  };
}

class EndlessLeaderboardService {
  constructor(repository) {
    this.repository = repository;
  }

  async sync(gameId, platform, userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'score' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const row = await this.repository.sync(
      gameId,
      platform,
      userId,
      score(body.score),
      cleanPlayerName(body.playerName)
    );
    return { bestScore: numberValue(row.best_score) };
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

module.exports = { EndlessLeaderboardService, entry, timestamp };
