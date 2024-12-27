import '../css/reset.css';
import '../css/styles.css';
import '../css/game-preview.css';
import { initAuth, isAuthenticated, login, register } from './utils/auth.js';
import { GameManager } from '../games/GameManager.js';
import { UserProfile } from './services/UserProfile.js';
import { PaymentSystem } from './services/PaymentSystem.js';
import { SlotGame } from '../games/slots/SlotGame.js';

// Game data with proper configuration
const games = {
    slots: {
        title: 'Lucky Fortune Slots',
        image: 'https://via.placeholder.com/300x200/1a1a1a/ffd700?text=Lucky+Fortune+Slots',
        minBetGold: 100,
        maxBetGold: 10000,
        minBetSweep: 0.2,
        maxBetSweep: 500,
        maxMultiplier: '5x',
        provider: 'GOLDWAVE',
        gameClass: SlotGame,
        features: [
            '🃏 Wild Symbol substitutes all regular symbols',
            '⭐ 3+ Scatters award 10 Free Spins',
            '🎁 3+ Bonus symbols trigger Bonus Round',
            '🎲 Multiple winning combinations',
            '🔄 Auto-spin feature available',
        ],
    },
    // Add more games here
};

class CasinoApp {
    constructor() {
        this.gameManager = new GameManager();
        this.userProfile = new UserProfile();
        this.paymentSystem = new PaymentSystem();
        this.currentGame = null;

        this.initializeApp();
    }

    async initializeApp() {
        // Initialize authentication
        await initAuth();

        // Check authentication status
        if (isAuthenticated()) {
            await this.userProfile.loadUserData();
            this.updateUIForAuthenticatedUser();
        } else {
            this.showLoginPrompt();
        }

        this.setupEventListeners();
        this.initializeGameCards();
    }

    setupEventListeners() {
        // Auth buttons
        document.querySelector('.login-btn').addEventListener('click', () => this.handleLogin());
        document
            .querySelector('.signup-btn')
            .addEventListener('click', () => this.handleRegister());

        // Game navigation
        const tabs = document.querySelectorAll('.nav-tabs a');
        tabs.forEach((tab) => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleTabChange(tab);
            });
        });

        // Balance management
        document
            .querySelector('.get-coins-btn')
            .addEventListener('click', () => this.handleGetCoins());
        document.querySelector('.redeem-btn').addEventListener('click', () => this.handleRedeem());
    }

    async handleLogin() {
        try {
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            
            const user = await login(username, password);
            this.userProfile.setUser(user);
            this.updateUIForAuthenticatedUser(user);
            this.showNotification('Login successful!');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleRegister() {
        try {
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            const email = document.getElementById('registerEmail').value;
            
            const user = await register(username, password, email);
            this.userProfile.setUser(user);
            this.updateUIForAuthenticatedUser(user);
            this.showNotification('Registration successful!');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleGetCoins() {
        if (!isAuthenticated()) {
            this.showLoginPrompt();
            return;
        }

        try {
            const amount = await this.paymentSystem.purchaseCoins();
            await this.userProfile.updateBalance(amount);
            this.updateBalanceDisplay();
            this.showNotification(`Successfully added ${amount.toLocaleString()} coins!`);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleRedeem() {
        if (!isAuthenticated()) {
            this.showLoginPrompt();
            return;
        }

        try {
            const amount = await this.paymentSystem.redeemCoins();
            await this.userProfile.updateBalance(-amount);
            this.updateBalanceDisplay();
            this.showNotification(`Successfully redeemed ${amount.toLocaleString()} coins!`);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    initializeGameCards() {
        Object.entries(games).forEach(([gameId, gameData]) => {
            const card = this.createGameCard(gameId, gameData);
            document.querySelector('#for-you-section .games-grid').appendChild(card);
        });
    }

    createGameCard(gameId, gameData) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.innerHTML = `
      <img src="${gameData.image}" alt="${gameData.title}">
      <div class="game-overlay">
        <span class="provider">${gameData.provider}</span>
      </div>
    `;

        card.addEventListener('click', () => this.handleGameClick(gameId, gameData));
        return card;
    }

    async handleGameClick(gameId, gameData) {
        if (!isAuthenticated()) {
            this.showLoginPrompt();
            return;
        }

        try {
            const card = document.querySelector(`[data-game="${gameId}"]`);
            card.classList.add('loading');

            // Initialize the game
            this.currentGame = new gameData.gameClass({
                container: 'game-container',
                userProfile: this.userProfile,
                paymentSystem: this.paymentSystem,
                config: gameData,
            });

            await this.currentGame.initialize();
            card.classList.remove('loading');

            // Show game container
            document.getElementById('game-container').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    updateUIForAuthenticatedUser() {
        const userData = this.userProfile.getData();
        document.querySelector('.coin-amount').textContent = userData.balance.toLocaleString();

        // Update auth buttons
        document.querySelector('.login-btn').style.display = 'none';
        document.querySelector('.signup-btn').style.display = 'none';

        // Add user profile button
        const profileBtn = document.createElement('button');
        profileBtn.className = 'profile-btn';
        profileBtn.textContent = userData.username;
        document.querySelector('.auth-buttons').appendChild(profileBtn);
    }

    showLoginPrompt() {
        this.showNotification('Please log in to play games!', 'info');
        this.handleLogin();
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Modal handling methods
    showLoginModal() {
        // Implementation for login modal
    }

    showRegistrationModal() {
        // Implementation for registration modal
    }
}

// Initialize the casino app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.casinoApp = new CasinoApp();
});
