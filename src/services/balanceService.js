'use strict';

class BalanceService {
  constructor(playersRepository) {
    this.playersRepository = playersRepository;
  }

  async get(gameId, platform, userId) {
    return this.playersRepository.getOrCreate(gameId, platform, userId);
  }
}

module.exports = { BalanceService };
