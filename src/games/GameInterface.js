export class GameInterface {
  constructor(containerId, user) {
    this.container = document.getElementById(containerId);
    this.user = user;
    this.minBet = 1;
    this.maxBet = 1000;
  }

  // Initialize the game
  init() {
    throw new Error('Init method must be implemented');
  }

  // Start a new game round
  start() {
    throw new Error('Start method must be implemented');
  }

  // Place a bet
  placeBet(amount) {
    if (amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet must be between ${this.minBet} and ${this.maxBet}`);
    }
    if (amount > this.user.balance) {
      throw new Error('Insufficient funds');
    }
  }

  // End the current game round
  end() {
    throw new Error('End method must be implemented');
  }

  // Clean up resources
  destroy() {
    throw new Error('Destroy method must be implemented');
  }
} 