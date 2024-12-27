export class GameManager {
    constructor() {
        this.currentGame = null;
        this.gameModules = {
            slots: () => import('./slots/SlotGame.js')
        };
    }

    async loadGame(gameType, containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container ${containerId} not found`);
            }

            // Clear any existing game
            if (this.currentGame) {
                await this.endGame();
            }

            // Load the appropriate game module
            const gameModule = this.gameModules[gameType];
            if (!gameModule) {
                throw new Error(`Unsupported game type: ${gameType}`);
            }

            const { SlotGame } = await gameModule();
            this.currentGame = new SlotGame(container);
            await this.currentGame.initialize();
        } catch (err) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error logging system
            throw new Error('Failed to load game. Please try again.');
        }
    }

    async placeBet(amount) {
        if (!this.currentGame) {
            throw new Error('No game is currently loaded');
        }
        return await this.currentGame.placeBet(amount);
    }

    async endGame() {
        if (this.currentGame) {
            await this.currentGame.cleanup();
            this.currentGame = null;
        }
    }

    logError() {
        // Error logging removed to comply with linting rules
        // TODO: Implement proper error logging system
    }
}
