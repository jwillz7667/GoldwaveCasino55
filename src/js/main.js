import '../css/reset.css';
import '../css/styles.css';
import '../css/game-preview.css';
import loadHeader from './utils/loadHeader';
import loadFooter from './utils/loadFooter';
import { initAuth } from './utils/auth';
import { GameManager } from '../games/GameManager';
import { GamePreview } from '../components/GamePreview';

// Define game data
const games = {
  slots: {
    title: 'Lucky Fortune Slots',
    image: 'https://via.placeholder.com/600x300',
    minBetGold: 100,
    maxBetGold: 10000,
    minBetSweep: 0.20,
    maxBetSweep: 500,
    maxMultiplier: '5x',
    tags: ['5 Reels', '7 Paylines', 'Free Spins', 'Bonus Round', 'Wild Symbols'],
    features: [
      '🃏 Wild Symbol substitutes all regular symbols',
      '⭐ 3+ Scatters award 10 Free Spins',
      '🎁 3+ Bonus symbols trigger Bonus Round',
      '🎲 Multiple winning combinations',
      '🔄 Auto-spin feature available'
    ],
    description: 'Experience the thrill of our premium 5-reel slot machine featuring Wild symbols, Scatter Free Spins, and an exciting Bonus Round! With 7 unique paylines and multipliers up to 5x, every spin could lead to massive wins!',
    onPlay: (mode) => {
      const gameManager = new GameManager();
      gameManager.loadGame('slots', 'game-container');
      document.getElementById('game-container').scrollIntoView({ behavior: 'smooth' });
    }
  },
  blackjack: {
    title: 'Classic Blackjack',
    image: 'https://via.placeholder.com/600x300',
    minBetGold: 500,
    maxBetGold: 1000000,
    minBetSweep: 1.00,
    maxBetSweep: 1000,
    maxMultiplier: '3x',
    tags: ['Table Game', 'Card Game', 'Strategy'],
    onPlay: (mode) => {
      const gameManager = new GameManager();
      gameManager.loadGame('blackjack', 'game-container');
      document.getElementById('game-container').scrollIntoView({ behavior: 'smooth' });
    }
  },
  roulette: {
    title: 'European Roulette',
    image: 'https://via.placeholder.com/600x300',
    minBetGold: 1000,
    maxBetGold: 2000000,
    minBetSweep: 2.00,
    maxBetSweep: 2000,
    maxMultiplier: '35x',
    tags: ['Table Game', 'Classic Casino', 'Strategy'],
    onPlay: (mode) => {
      const gameManager = new GameManager();
      gameManager.loadGame('roulette', 'game-container');
      document.getElementById('game-container').scrollIntoView({ behavior: 'smooth' });
    }
  },
  poker: {
    title: 'Texas Hold\'em Poker',
    image: 'https://via.placeholder.com/600x300',
    minBetGold: 1000,
    maxBetGold: 5000000,
    minBetSweep: 5.00,
    maxBetSweep: 5000,
    maxMultiplier: '500x',
    tags: ['Card Game', 'Skill Game', 'Multiplayer'],
    onPlay: (mode) => {
      const gameManager = new GameManager();
      gameManager.loadGame('poker', 'game-container');
      document.getElementById('game-container').scrollIntoView({ behavior: 'smooth' });
    }
  }
};

// Load Header and Footer
document.getElementById('header').innerHTML = loadHeader();
document.getElementById('footer').innerHTML = loadFooter();

// Initialize authentication
initAuth();

// Initialize game manager
const gameManager = new GameManager();

// Add click handlers to game cards
document.querySelectorAll('.game-card').forEach(card => {
  card.addEventListener('click', () => {
    const gameType = card.getAttribute('data-game');
    const gameData = games[gameType];
    
    if (!gameData) return;
    
    const preview = new GamePreview(gameData);
    preview.show();
  });
});

// Play Now button
document.querySelector('.play-now-btn').addEventListener('click', () => {
  const firstGame = document.querySelector('.game-card');
  if (firstGame) {
    firstGame.click();
  }
}); 