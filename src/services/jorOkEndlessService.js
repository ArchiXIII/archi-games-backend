'use strict';

const { HttpError } = require('../response');
const { numberValue } = require('../db/values');
const { score, cleanPlayerName } = require('./leaderboardService');

function mapEntries(rows, currentUserId) {
  return rows.map((row, index) => {
    const userId = String(row.platform_user_id);
    const bestScore = numberValue(row.best_score);
    return {
      rank: index + 1,
      userId,
      playerName: row.player_name || userId,
      score: bestScore,
      bestScore,
      isCurrentUser: userId === currentUserId
    };
  });
}

class JorOkEndlessService {
  constructor(repository) {
    this.repository = repository;
    this.syncPromises = new Map();
    this.listPromise = null;
  }

  async sync(userId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'score' && key !== 'playerName')) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request');
    }
    const bestScore = score(body.score);
    const playerName = cleanPlayerName(body.playerName);
    const key = `${userId}:${bestScore}:${playerName}`;
    if (this.syncPromises.has(key)) return this.syncPromises.get(key);
    const promise = this.repository.sync(userId, bestScore, playerName)
      .then((rows) => this.payload(rows, userId, bestScore))
      .finally(() => this.syncPromises.delete(key));
    this.syncPromises.set(key, promise);
    return promise;
  }

  async list(userId) {
    if (!this.listPromise) {
      this.listPromise = this.repository.list().finally(() => {
        this.listPromise = null;
      });
    }
    return this.listPromise.then((rows) => this.payload(rows, userId, 0));
  }

  payload(rows, userId, submittedScore) {
    const entries = mapEntries(rows, userId);
    const currentUser = entries.find((entry) => entry.isCurrentUser) || null;
    return {
      entries,
      currentUser,
      bestScore: currentUser ? currentUser.bestScore : submittedScore,
      limit: 10,
      offset: 0
    };
  }
}

module.exports = { JorOkEndlessService, mapEntries };
