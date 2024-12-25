import { api } from '../js/services/api';

export class GameManager {
  constructor() {
    this.currentGame = null;
  }

  async loadGame(gameType, containerId) {
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error('Game container not found');

      // Cleanup previous game if exists
      if (this.currentGame && this.currentGame.destroy) {
        this.currentGame.destroy();
      }

      // Dynamic import using webpack chunk naming
      const game = await import(
        /* webpackChunkName: "[request]" */
        `./${gameType}/${gameType}.js`
      );

      if (game && game.init) {
        this.currentGame = game.init(container);
      } else {
        throw new Error('Game implementation not found');
      }
    } catch (error) {
      console.error('Error loading game:', error);
      throw error;
    }
  }

  async placeBet(amount) {
    if (!this.currentGame) {
      throw new Error('No game is currently loaded');
    }

    try {
      await this.currentGame.placeBet(amount);
    } catch (error) {
      console.error('Error placing bet:', error);
      throw error;
    }
  }

  async endGame() {
    if (this.currentGame) {
      await this.currentGame.end();
      this.currentGame = null;
    }
  }
} 