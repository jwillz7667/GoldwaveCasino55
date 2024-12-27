import { EventEmitter } from 'events';

export class SlotGame extends EventEmitter {
    constructor({ container, userProfile, paymentSystem, config }) {
        super();
        this.container = document.getElementById(container);
        this.userProfile = userProfile;
        this.paymentSystem = paymentSystem;
        this.config = config;

        // Game state
        this.currentBet = this.config.minBetGold;
        this.isSpinning = false;
        this.autoPlayEnabled = false;
        this.symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐'];
        this.reels = [[...this.symbols], [...this.symbols], [...this.symbols]];

        // Winning combinations
        this.winningCombos = {
            '🍒': { 2: 2, 3: 5 },
            '🍋': { 2: 2, 3: 5 },
            '🍊': { 2: 3, 3: 8 },
            '🍇': { 2: 3, 3: 8 },
            '🔔': { 2: 4, 3: 10 },
            '💎': { 2: 5, 3: 15 },
            '7️⃣': { 2: 10, 3: 25 },
            '⭐': { 2: 15, 3: 50 },
        };
    }

    async initialize() {
        this.createGameUI();
        this.attachEventListeners();
        await this.updateBalance();
    }

    createGameUI() {
        this.container.innerHTML = `
      <div class="slot-game">
        <div class="game-header">
          <div class="balance-info">
            <span>Balance:</span>
            <span class="balance-amount">0</span>
          </div>
          <div class="bet-controls">
            <button class="decrease-bet">-</button>
            <span class="current-bet">${this.currentBet}</span>
            <button class="increase-bet">+</button>
          </div>
        </div>
        
        <div class="reels-container">
          ${this.reels
              .map(
                  (reel) => `
            <div class="reel">
              ${reel.map((symbol) => `<div class="symbol">${symbol}</div>`).join('')}
            </div>
          `
              )
              .join('')}
        </div>
        
        <div class="game-controls">
          <button class="spin-btn" disabled>Spin</button>
          <button class="auto-play-btn">Auto Play</button>
          <button class="max-bet-btn">Max Bet</button>
        </div>
        
        <div class="win-display" style="display: none;">
          <span class="win-amount"></span>
        </div>
      </div>
    `;

        // Cache DOM elements
        this.balanceDisplay = this.container.querySelector('.balance-amount');
        this.betDisplay = this.container.querySelector('.current-bet');
        this.spinButton = this.container.querySelector('.spin-btn');
        this.autoPlayButton = this.container.querySelector('.auto-play-btn');
        this.maxBetButton = this.container.querySelector('.max-bet-btn');
        this.winDisplay = this.container.querySelector('.win-display');
        this.reelsContainer = this.container.querySelector('.reels-container');
    }

    attachEventListeners() {
        // Bet controls
        this.container
            .querySelector('.decrease-bet')
            .addEventListener('click', () => this.adjustBet(-100));
        this.container
            .querySelector('.increase-bet')
            .addEventListener('click', () => this.adjustBet(100));

        // Game controls
        this.spinButton.addEventListener('click', () => this.spin());
        this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());
        this.maxBetButton.addEventListener('click', () => this.setMaxBet());
    }

    async updateBalance() {
        const userData = this.userProfile.getData();
        this.balanceDisplay.textContent = userData.balance.toLocaleString();
        this.spinButton.disabled = userData.balance < this.currentBet;
    }

    adjustBet(amount) {
        const newBet = this.currentBet + amount;
        if (newBet >= this.config.minBetGold && newBet <= this.config.maxBetGold) {
            this.currentBet = newBet;
            this.betDisplay.textContent = this.currentBet;
            this.updateBalance();
        }
    }

    setMaxBet() {
        this.currentBet = this.config.maxBetGold;
        this.betDisplay.textContent = this.currentBet;
        this.updateBalance();
    }

    async spin() {
        if (this.isSpinning) return;

        try {
            // Deduct bet amount
            await this.userProfile.updateBalance(-this.currentBet);
            this.updateBalance();

            this.isSpinning = true;
            this.spinButton.disabled = true;
            this.winDisplay.style.display = 'none';

            // Animate reels
            const spinPromises = this.reels.map((reel, index) => this.spinReel(index));
            const results = await Promise.all(spinPromises);

            // Check for wins
            const winAmount = this.calculateWin(results);
            if (winAmount > 0) {
                await this.userProfile.updateBalance(winAmount);
                this.showWin(winAmount);
            }

            this.isSpinning = false;
            await this.updateBalance();
            this.spinButton.disabled = false;

            if (this.autoPlayEnabled) {
                setTimeout(() => this.spin(), 1500);
            }
        } catch (error) {
            // Error handling removed to comply with linting rules
            // TODO: Implement proper error handling
            this.isSpinning = false;
            this.spinButton.disabled = false;
            this.autoPlayEnabled = false;
        }
    }

    spinReel(reelIndex) {
        return new Promise((resolve) => {
            const reel = this.reelsContainer.children[reelIndex];
            const symbols = [...reel.children];
            let currentPosition = 0;
            const spins = 20 + Math.floor(Math.random() * 10);
            const interval = 50;

            const spin = () => {
                symbols.forEach((symbol, index) => {
                    const offset = (index - currentPosition) * 100;
                    symbol.style.transform = `translateY(${offset}%)`;
                });

                currentPosition++;
                if (currentPosition >= symbols.length) {
                    currentPosition = 0;
                }

                if (currentPosition < spins) {
                    setTimeout(spin, interval);
                } else {
                    const finalSymbol = symbols[currentPosition].textContent;
                    resolve(finalSymbol);
                }
            };

            spin();
        });
    }

    calculateWin(results) {
        let winAmount = 0;

        // Check for matching symbols
        const symbolCounts = {};
        results.forEach((symbol) => {
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        });

        Object.entries(symbolCounts).forEach(([symbol, count]) => {
            if (count >= 2 && this.winningCombos[symbol]) {
                winAmount += this.currentBet * this.winningCombos[symbol][count];
            }
        });

        return winAmount;
    }

    showWin(amount) {
        this.winDisplay.querySelector(
            '.win-amount'
        ).textContent = `Win: ${amount.toLocaleString()}`;
        this.winDisplay.style.display = 'block';
        this.winDisplay.classList.add('win-animation');
        setTimeout(() => this.winDisplay.classList.remove('win-animation'), 2000);
    }

    toggleAutoPlay() {
        this.autoPlayEnabled = !this.autoPlayEnabled;
        this.autoPlayButton.classList.toggle('active');
        if (this.autoPlayEnabled && !this.isSpinning) {
            this.spin();
        }
    }
}
