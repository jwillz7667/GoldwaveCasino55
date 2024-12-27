import { GameInterface } from '../GameInterface.js';
import { api } from '../../js/services/api.js';
import './blackjack.css';

export default class Blackjack extends GameInterface {
    constructor(containerId, user) {
        super(containerId, user);
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.currentBet = 0;
        this.gameStatus = 'waiting'; // waiting, playing, ended
    }

    async init() {
        this.container.innerHTML = `
      <div class="blackjack-table">
        <div class="dealer-hand">
          <h3>Dealer's Hand: <span id="dealer-score">0</span></h3>
          <div id="dealer-cards" class="cards"></div>
        </div>
        
        <div class="player-hand">
          <h3>Your Hand: <span id="player-score">0</span></h3>
          <div id="player-cards" class="cards"></div>
        </div>
        
        <div class="game-controls">
          <div class="bet-controls">
            <input type="number" id="bet-amount" min="${this.minBet}" max="${this.maxBet}" value="${this.minBet}">
            <button id="place-bet-btn">Place Bet</button>
          </div>
          
          <div class="action-controls" style="display: none;">
            <button id="hit-btn">Hit</button>
            <button id="stand-btn">Stand</button>
            <button id="double-btn">Double Down</button>
          </div>
        </div>
        
        <div class="game-info">
          <p>Balance: $<span id="balance">${this.user.balance}</span></p>
          <p>Current Bet: $<span id="current-bet">0</span></p>
          <p id="game-message"></p>
        </div>
      </div>
    `;

        this.setupEventListeners();
        this.initializeDeck();
    }

    initializeDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        this.deck = [];
        for (let suit of suits) {
            for (let value of values) {
                this.deck.push({ suit, value });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    setupEventListeners() {
        const placeBetBtn = this.container.querySelector('#place-bet-btn');
        const hitBtn = this.container.querySelector('#hit-btn');
        const standBtn = this.container.querySelector('#stand-btn');
        const doubleBtn = this.container.querySelector('#double-btn');

        placeBetBtn.addEventListener('click', () => this.startGame());
        hitBtn.addEventListener('click', () => this.hit());
        standBtn.addEventListener('click', () => this.stand());
        doubleBtn.addEventListener('click', () => this.doubleDown());
    }

    async startGame() {
        const betAmount = Number(this.container.querySelector('#bet-amount').value);
        try {
            await this.placeBet(betAmount);
            this.currentBet = betAmount;
            this.gameStatus = 'playing';

            // Update UI
            this.container.querySelector('#current-bet').textContent = betAmount;
            this.container.querySelector('.bet-controls').style.display = 'none';
            this.container.querySelector('.action-controls').style.display = 'flex';

            // Deal initial cards
            this.playerHand = [this.drawCard(), this.drawCard()];
            this.dealerHand = [this.drawCard(), this.drawCard()];

            this.updateCardDisplay();
            this.checkForBlackjack();
        } catch (error) {
            alert(error.message);
        }
    }

    drawCard() {
        if (this.deck.length === 0) {
            this.initializeDeck();
        }
        return this.deck.pop();
    }

    getCardValue(card) {
        if (['J', 'Q', 'K'].includes(card.value)) return 10;
        if (card.value === 'A') return 11;
        return parseInt(card.value);
    }

    calculateHandValue(hand) {
        let value = 0;
        let aces = 0;

        for (let card of hand) {
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else {
                value += this.getCardValue(card);
            }
        }

        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    updateCardDisplay() {
        const playerCards = this.container.querySelector('#player-cards');
        const dealerCards = this.container.querySelector('#dealer-cards');

        playerCards.innerHTML = this.playerHand
            .map(
                (card) =>
                    `<div class="card ${
                        card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'
                    }">${card.value}${card.suit}</div>`
            )
            .join('');

        // Show dealer's first card, hide second during gameplay
        if (this.gameStatus === 'playing') {
            dealerCards.innerHTML = `
        <div class="card ${
            this.dealerHand[0].suit === '♥' || this.dealerHand[0].suit === '♦' ? 'red' : 'black'
        }">
          ${this.dealerHand[0].value}${this.dealerHand[0].suit}
        </div>
        <div class="card back">?</div>
      `;
        } else {
            dealerCards.innerHTML = this.dealerHand
                .map(
                    (card) =>
                        `<div class="card ${
                            card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'
                        }">${card.value}${card.suit}</div>`
                )
                .join('');
        }

        this.container.querySelector('#player-score').textContent = this.calculateHandValue(
            this.playerHand
        );
        if (this.gameStatus !== 'playing') {
            this.container.querySelector('#dealer-score').textContent = this.calculateHandValue(
                this.dealerHand
            );
        }
    }

    async hit() {
        this.playerHand.push(this.drawCard());
        this.updateCardDisplay();

        const playerValue = this.calculateHandValue(this.playerHand);
        if (playerValue > 21) {
            await this.endGame('bust');
        }
    }

    async stand() {
        this.gameStatus = 'ended';

        // Dealer must hit on 16 and below, stand on 17 and above
        while (this.calculateHandValue(this.dealerHand) < 17) {
            this.dealerHand.push(this.drawCard());
        }

        this.updateCardDisplay();
        await this.determineWinner();
    }

    async doubleDown() {
        if (this.currentBet * 2 > this.user.balance) {
            alert('Insufficient funds to double down');
            return;
        }

        this.currentBet *= 2;
        this.container.querySelector('#current-bet').textContent = this.currentBet;

        // Draw one final card and stand
        this.playerHand.push(this.drawCard());
        this.updateCardDisplay();

        const playerValue = this.calculateHandValue(this.playerHand);
        if (playerValue > 21) {
            await this.endGame('bust');
        } else {
            await this.stand();
        }
    }

    async checkForBlackjack() {
        const playerValue = this.calculateHandValue(this.playerHand);
        const dealerValue = this.calculateHandValue(this.dealerHand);

        if (playerValue === 21 || dealerValue === 21) {
            this.gameStatus = 'ended';
            this.updateCardDisplay();
            await this.determineWinner();
        }
    }

    async determineWinner() {
        const playerValue = this.calculateHandValue(this.playerHand);
        const dealerValue = this.calculateHandValue(this.dealerHand);
        let message = '';
        let winAmount = 0;

        if (playerValue > 21) {
            message = 'Bust! You lose!';
        } else if (dealerValue > 21) {
            message = 'Dealer busts! You win!';
            winAmount = this.currentBet * 2;
        } else if (playerValue > dealerValue) {
            message = 'You win!';
            winAmount = this.currentBet * 2;
        } else if (playerValue < dealerValue) {
            message = 'Dealer wins!';
        } else {
            message = 'Push!';
            winAmount = this.currentBet;
        }

        if (winAmount > 0) {
            await api.deposit(winAmount);
            const profile = await api.getProfile();
            this.container.querySelector('#balance').textContent = profile.balance;
        }

        this.container.querySelector('#game-message').textContent = message;
        this.resetGame();
    }

    async endGame(reason) {
        this.gameStatus = 'ended';
        this.updateCardDisplay();

        if (reason === 'bust') {
            this.container.querySelector('#game-message').textContent = 'Bust! You lose!';
        }

        this.resetGame();
    }

    resetGame() {
        this.currentBet = 0;
        this.container.querySelector('#current-bet').textContent = '0';
        this.container.querySelector('.bet-controls').style.display = 'flex';
        this.container.querySelector('.action-controls').style.display = 'none';

        setTimeout(() => {
            this.playerHand = [];
            this.dealerHand = [];
            this.gameStatus = 'waiting';
            this.initializeDeck();
            this.updateCardDisplay();
            this.container.querySelector('#game-message').textContent = '';
        }, 2000);
    }

    destroy() {
        this.container.innerHTML = '';
    }
}
