import './slots.css';

class SlotMachine {
  constructor(container) {
    this.container = container;
    this.reels = 5;
    this.rows = 3;
    this.spinning = false;
    this.currentBet = 0.20;
    this.balance = 100.00;
    this.freeSpins = 0;
    this.multiplier = 1;
    this.autoSpinning = false;
    this.spinSpeed = 100;
    this.spinDuration = 2000;
    this.symbols = [
      { name: 'wild', value: 5, image: '🃏', isWild: true, frequency: 1 },
      { name: 'scatter', value: 2, image: '⭐', isScatter: true, frequency: 1 },
      { name: 'bonus', value: 3, image: '🎁', isBonus: true, frequency: 1 },
      { name: 'seven', value: 4, image: '7️⃣', frequency: 2 },
      { name: 'diamond', value: 3, image: '💎', frequency: 3 },
      { name: 'bell', value: 2, image: '🔔', frequency: 4 },
      { name: 'cherry', value: 1, image: '🍒', frequency: 5 },
      { name: 'lemon', value: 1, image: '🍋', frequency: 5 },
      { name: 'orange', value: 1, image: '🍊', frequency: 5 },
      { name: 'plum', value: 1, image: '🫐', frequency: 5 }
    ];
    this.paylines = [
      { name: 'Top Line', path: [[0,0], [1,0], [2,0], [3,0], [4,0]] },
      { name: 'Center Line', path: [[0,1], [1,1], [2,1], [3,1], [4,1]] },
      { name: 'Bottom Line', path: [[0,2], [1,2], [2,2], [3,2], [4,2]] },
      { name: 'V Shape', path: [[0,0], [1,1], [2,2], [3,1], [4,0]] },
      { name: 'Inverted V', path: [[0,2], [1,1], [2,0], [3,1], [4,2]] },
      { name: 'W Shape', path: [[0,0], [1,2], [2,0], [3,2], [4,0]] },
      { name: 'M Shape', path: [[0,2], [1,0], [2,2], [3,0], [4,2]] },
      { name: 'Zigzag Up', path: [[0,2], [1,1], [2,0], [3,1], [4,2]] },
      { name: 'Zigzag Down', path: [[0,0], [1,1], [2,2], [3,1], [4,0]] }
    ];
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="slot-machine">
        <div class="slot-header">
          <div class="stats">
            <div class="balance">Balance: $<span class="balance-amount">${this.formatMoney(this.balance)}</span></div>
            <div class="free-spins ${this.freeSpins ? '' : 'hidden'}">
              Free Spins: <span class="free-spins-amount">${this.freeSpins}</span>
            </div>
            <div class="multiplier ${this.multiplier > 1 ? '' : 'hidden'}">
              Multiplier: <span class="multiplier-amount">${this.multiplier}x</span>
            </div>
          </div>
          <div class="current-bet">
            <button class="bet-btn decrease">-</button>
            <span class="bet-amount">$${this.formatMoney(this.currentBet)}</span>
            <button class="bet-btn increase">+</button>
          </div>
        </div>
        
        <div class="slot-display">
          <div class="reels-container"></div>
          <div class="paylines-overlay"></div>
          <div class="win-overlay hidden">
            <div class="win-message"></div>
          </div>
          <div class="bonus-overlay hidden">
            <div class="bonus-content">
              <h2>Bonus Round!</h2>
              <div class="bonus-options"></div>
            </div>
          </div>
        </div>
        
        <div class="slot-controls">
          <button class="max-bet-btn">Max Bet</button>
          <button class="spin-btn">Spin</button>
          <button class="auto-spin-btn">Auto Spin</button>
        </div>
        
        <div class="paylines-display"></div>
      </div>
    `;

    this.reelsContainer = this.container.querySelector('.reels-container');
    this.winOverlay = this.container.querySelector('.win-overlay');
    this.winMessage = this.container.querySelector('.win-message');
    this.bonusOverlay = this.container.querySelector('.bonus-overlay');
    this.bonusContent = this.container.querySelector('.bonus-content');
    this.balanceDisplay = this.container.querySelector('.balance-amount');
    this.betDisplay = this.container.querySelector('.bet-amount');
    this.freeSpinsDisplay = this.container.querySelector('.free-spins');
    this.freeSpinsAmount = this.container.querySelector('.free-spins-amount');
    this.multiplierDisplay = this.container.querySelector('.multiplier');
    this.multiplierAmount = this.container.querySelector('.multiplier-amount');
    this.paylinesOverlay = this.container.querySelector('.paylines-overlay');
    
    this.createReels();
    this.setupControls();
    this.showPaylines();
  }

  createReels() {
    this.reelsContainer.innerHTML = '';
    for (let i = 0; i < this.reels; i++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      
      for (let j = 0; j < this.rows; j++) {
        const symbol = document.createElement('div');
        symbol.className = 'symbol';
        const randomSymbol = this.getRandomSymbol();
        symbol.textContent = randomSymbol.image;
        if (randomSymbol.isWild) symbol.classList.add('wild');
        if (randomSymbol.isScatter) symbol.classList.add('scatter');
        if (randomSymbol.isBonus) symbol.classList.add('bonus');
        reel.appendChild(symbol);
      }
      
      this.reelsContainer.appendChild(reel);
    }
  }

  setupControls() {
    const spinBtn = this.container.querySelector('.spin-btn');
    const maxBetBtn = this.container.querySelector('.max-bet-btn');
    const autoSpinBtn = this.container.querySelector('.auto-spin-btn');
    const decreaseBtn = this.container.querySelector('.decrease');
    const increaseBtn = this.container.querySelector('.increase');

    spinBtn.addEventListener('click', () => this.spin());
    maxBetBtn.addEventListener('click', () => this.setMaxBet());
    autoSpinBtn.addEventListener('click', () => this.toggleAutoSpin());
    decreaseBtn.addEventListener('click', () => this.adjustBet(-0.20));
    increaseBtn.addEventListener('click', () => this.adjustBet(0.20));
  }

  getRandomSymbol() {
    const totalFrequency = this.symbols.reduce((sum, symbol) => sum + symbol.frequency, 0);
    let random = Math.floor(Math.random() * totalFrequency);
    
    for (const symbol of this.symbols) {
      if (random < symbol.frequency) return symbol;
      random -= symbol.frequency;
    }
    
    return this.symbols[0];
  }

  async spin() {
    if (this.spinning || (this.balance < this.currentBet && !this.freeSpins)) return;
    
    this.spinning = true;
    if (!this.freeSpins) {
      this.balance -= this.currentBet;
      this.updateBalance();
    } else {
      this.freeSpins--;
      this.updateFreeSpins();
    }
    
    const reels = this.container.querySelectorAll('.reel');
    const spinPromises = [];
    
    reels.forEach((reel, i) => {
      spinPromises.push(this.spinReel(reel, i));
    });
    
    await Promise.all(spinPromises);
    
    const result = this.checkWin();
    if (result.win) {
      this.showWin(result);
    }
    
    if (result.bonusTriggered) {
      await this.startBonusRound();
    }
    
    if (result.freeSpinsTriggered) {
      this.awardFreeSpins(result.freeSpinsAmount);
    }
    
    this.spinning = false;
    
    if (this.autoSpinning && this.balance >= this.currentBet) {
      setTimeout(() => this.spin(), 1000);
    }
  }

  async spinReel(reel, delay) {
    return new Promise(resolve => {
      const symbols = reel.children;
      let currentPos = 0;
      const finalPos = 20 + Math.floor(Math.random() * 5); // More spins for longer animation
      
      const spinInterval = setInterval(() => {
        Array.from(symbols).forEach(symbol => {
          symbol.classList.add('spinning');
        });
        
        if (currentPos >= finalPos) {
          clearInterval(spinInterval);
          Array.from(symbols).forEach(symbol => {
            symbol.classList.remove('spinning');
            symbol.classList.add('settling');
          });
          
          setTimeout(() => {
            Array.from(symbols).forEach(symbol => {
              symbol.classList.remove('settling');
              symbol.classList.add('landed');
            });
            resolve();
          }, 300);
        }
        
        // Move symbols
        const firstSymbol = symbols[0];
        reel.appendChild(firstSymbol);
        currentPos++;
      }, this.spinSpeed);
    });
  }

  checkWin() {
    const reels = this.container.querySelectorAll('.reel');
    const grid = Array.from(reels).map(reel => 
      Array.from(reel.querySelectorAll('.symbol')).map(symbol => ({
        image: symbol.textContent,
        isWild: symbol.classList.contains('wild'),
        isScatter: symbol.classList.contains('scatter'),
        isBonus: symbol.classList.contains('bonus')
      }))
    );
    
    let totalWin = 0;
    const winningLines = [];
    let scatterCount = 0;
    let bonusCount = 0;
    
    // Count scatters and bonus symbols
    grid.forEach(reel => {
      reel.forEach(symbol => {
        if (symbol.isScatter) scatterCount++;
        if (symbol.isBonus) bonusCount++;
      });
    });
    
    // Check paylines
    this.paylines.forEach((payline, index) => {
      const symbols = payline.path.map(([x, y]) => grid[x][y]);
      const firstSymbol = symbols[0];
      const matches = symbols.filter(s => 
        s.image === firstSymbol.image || 
        s.isWild || 
        firstSymbol.isWild
      ).length;
      
      if (matches >= 3) {
        const symbolObj = this.symbols.find(s => s.image === firstSymbol.image) || this.symbols[0];
        const win = this.currentBet * symbolObj.value * (matches - 2) * this.multiplier;
        totalWin += win;
        winningLines.push(index); // Just push the index
      }
    });
    
    return {
      win: totalWin > 0,
      amount: totalWin,
      lines: winningLines.map(index => ({ name: this.paylines[index].name })), // Convert index to line name
      bonusTriggered: bonusCount >= 3,
      freeSpinsTriggered: scatterCount >= 3,
      freeSpinsAmount: scatterCount >= 3 ? 10 : 0
    };
  }

  async startBonusRound() {
    return new Promise(resolve => {
      const options = [
        { multiplier: 2, spins: 5 },
        { multiplier: 3, spins: 3 },
        { multiplier: 5, spins: 1 }
      ];
      
      this.bonusOverlay.classList.remove('hidden');
      const optionsContainer = this.bonusContent.querySelector('.bonus-options');
      
      optionsContainer.innerHTML = options.map((option, index) => `
        <button class="bonus-option">
          <div class="bonus-option-content">
            <div class="bonus-multiplier">${option.multiplier}x</div>
            <div class="bonus-spins">${option.spins} Free Spins</div>
          </div>
        </button>
      `).join('');
      
      const buttons = optionsContainer.querySelectorAll('.bonus-option');
      buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
          this.multiplier = options[index].multiplier;
          this.awardFreeSpins(options[index].spins);
          this.bonusOverlay.classList.add('hidden');
          this.updateMultiplier();
          resolve();
        });
      });
    });
  }

  awardFreeSpins(amount) {
    this.freeSpins += amount;
    this.updateFreeSpins();
  }

  showWin({ amount, lines }) {
    this.balance += amount;
    this.updateBalance();
    
    // Show winning paylines with enhanced animation
    this.paylinesOverlay.innerHTML = '';
    
    // Show each winning line sequentially
    lines.forEach((line, index) => {
      setTimeout(() => {
        // Find the payline by name
        const payline = this.paylines.find(p => p.name === line.name);
        if (!payline) return; // Skip if payline not found
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        // Calculate path coordinates
        const pathCoords = payline.path.map(([x, y]) => {
          const symbol = this.reelsContainer.children[x].children[y];
          const rect = symbol.getBoundingClientRect();
          const containerRect = this.reelsContainer.getBoundingClientRect();
          return [
            rect.left - containerRect.left + rect.width / 2,
            rect.top - containerRect.top + rect.height / 2
          ];
        });
        
        // Create SVG path
        const pathD = `M ${pathCoords[0][0]},${pathCoords[0][1]} ` +
          pathCoords.slice(1).map(([x, y]) => `L ${x},${y}`).join(' ');
        
        path.setAttribute('d', pathD);
        path.classList.add('payline-path');
        path.style.stroke = `hsl(${index * 40}, 100%, 50%)`;
        path.style.strokeWidth = '4';
        path.style.fill = 'none';
        
        // Add payline label
        label.textContent = payline.name;
        label.setAttribute('x', pathCoords[2][0]);
        label.setAttribute('y', pathCoords[2][1] - 20);
        label.classList.add('payline-label');
        label.style.fill = `hsl(${index * 40}, 100%, 50%)`;
        
        this.paylinesOverlay.appendChild(path);
        this.paylinesOverlay.appendChild(label);
        
        // Highlight winning symbols
        payline.path.forEach(([x, y]) => {
          const symbol = this.reelsContainer.children[x].children[y];
          symbol.classList.add('winner');
        });
      }, index * 500); // Stagger the display of each line
    });

    // Show win amount with animation
    if (amount > 0) {
      this.animateWinAmount(amount);
      if (amount >= this.currentBet * 20) {
        this.playCelebrationAnimation();
      }
    }
  }

  animateWinAmount(amount) {
    const winLabel = document.createElement('div');
    winLabel.classList.add('win-amount-label');
    winLabel.textContent = `WIN! $${amount.toFixed(2)}`;
    winLabel.style.position = 'absolute';
    winLabel.style.top = '50%';
    winLabel.style.left = '50%';
    winLabel.style.transform = 'translate(-50%, -50%)';
    this.reelsContainer.appendChild(winLabel);

    if (amount >= this.currentBet * 20) {
      const bigWinText = document.createElement('div');
      bigWinText.classList.add('big-win-text');
      bigWinText.textContent = 'BIG WIN!';
      this.reelsContainer.appendChild(bigWinText);

      setTimeout(() => {
        bigWinText.remove();
      }, 3000);
    }

    setTimeout(() => {
      winLabel.remove();
    }, 2000);
  }

  playCelebrationAnimation() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.classList.add('confetti');
      confetti.style.setProperty('--x', `${Math.random() * 100}%`);
      confetti.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
      confetti.style.setProperty('--rotation', `${Math.random() * 360}deg`);
      confetti.style.setProperty('--delay', `${Math.random() * 1.5}s`);
      confetti.style.setProperty('--fall-duration', `${Math.random() * 2 + 2}s`);
      
      this.reelsContainer.appendChild(confetti);
      
      // Remove confetti after animation
      confetti.addEventListener('animationend', () => {
        confetti.remove();
      });
    }
  }

  adjustBet(increment) {
    const newBet = Math.round((this.currentBet + increment) * 100) / 100;
    if (newBet >= this.betIncrement && newBet <= this.maxBet) {
      this.currentBet = newBet;
      this.updateBetDisplay();
    }
  }

  updateBetDisplay() {
    const betDisplay = document.querySelector('.current-bet');
    if (betDisplay) {
      betDisplay.textContent = `Bet: $${this.currentBet.toFixed(2)}`;
    }
  }

  setMaxBet() {
    this.currentBet = Math.min(5.00, this.balance);
    this.betDisplay.textContent = `$${this.formatMoney(this.currentBet)}`;
  }

  toggleAutoSpin() {
    this.autoSpinning = !this.autoSpinning;
    const autoSpinBtn = this.container.querySelector('.auto-spin-btn');
    autoSpinBtn.classList.toggle('active');
    
    if (this.autoSpinning && !this.spinning) {
      this.spin();
    }
  }

  updateBalance() {
    this.balanceDisplay.textContent = this.formatMoney(this.balance);
  }

  updateFreeSpins() {
    this.freeSpinsDisplay.classList.toggle('hidden', this.freeSpins === 0);
    this.freeSpinsAmount.textContent = this.freeSpins;
    
    if (this.freeSpins === 0) {
      this.multiplier = 1;
      this.updateMultiplier();
    }
  }

  updateMultiplier() {
    this.multiplierDisplay.classList.toggle('hidden', this.multiplier === 1);
    this.multiplierAmount.textContent = `${this.multiplier}x`;
  }

  showPaylines() {
    const paylinesDisplay = this.container.querySelector('.paylines-display');
    paylinesDisplay.innerHTML = `
      <div class="paylines-title">Winning Combinations</div>
      <div class="paylines-grid">
        ${this.symbols.map(symbol => `
          <div class="payline-item">
            <span class="symbol ${symbol.isWild ? 'wild' : ''} ${symbol.isScatter ? 'scatter' : ''} ${symbol.isBonus ? 'bonus' : ''}">${symbol.image}</span>
            <span class="multiplier">x${symbol.value}</span>
            ${symbol.isWild ? '<span class="symbol-tag">Wild</span>' : ''}
            ${symbol.isScatter ? '<span class="symbol-tag">Scatter</span>' : ''}
            ${symbol.isBonus ? '<span class="symbol-tag">Bonus</span>' : ''}
          </div>
        `).join('')}
      </div>
      <div class="feature-info">
        <div class="feature">
          <span class="feature-title">⭐ 3 or more Scatters:</span>
          <span class="feature-desc">Award 10 Free Spins</span>
        </div>
        <div class="feature">
          <span class="feature-title">🎁 3 or more Bonus:</span>
          <span class="feature-desc">Trigger Bonus Round</span>
        </div>
        <div class="feature">
          <span class="feature-title">🃏 Wild Symbol:</span>
          <span class="feature-desc">Substitutes for any symbol except Scatter and Bonus</span>
        </div>
      </div>
    `;
  }

  formatMoney(amount) {
    return amount.toFixed(2);
  }
}

export function init(container) {
  return new SlotMachine(container);
} 