export class GamePreview {
  constructor(gameData) {
    this.gameData = gameData;
    this.modal = null;
  }

  show() {
    this.createModal();
    document.body.appendChild(this.modal);
  }

  hide() {
    if (this.modal) {
      this.modal.remove();
    }
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'game-preview-modal';
    
    const content = document.createElement('div');
    content.className = 'game-preview-content';
    
    content.innerHTML = `
      <div class="game-preview-header">
        <h2>${this.gameData.title}</h2>
        <button class="close-preview">&times;</button>
      </div>
      
      <div class="game-preview-body">
        <div class="game-preview-image">
          <img src="${this.gameData.image}" alt="${this.gameData.title}">
        </div>
        
        <div class="game-description">
          ${this.gameData.description || ''}
        </div>
        
        <div class="game-stats">
          <div class="stat-row">
            <span class="stat-label">Gold Coins Bet Range</span>
            <div class="stat-value">
              <span class="gold-coins">${this.formatNumber(this.gameData.minBetGold)} - ${this.formatNumber(this.gameData.maxBetGold)}</span>
            </div>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">Sweep Coins Bet Range</span>
            <div class="stat-value">
              <span class="sweep-coins">${this.gameData.minBetSweep.toFixed(2)} - ${this.gameData.maxBetSweep.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="stat-row">
            <span class="stat-label">Max Multiplier</span>
            <div class="stat-value">${this.gameData.maxMultiplier}</div>
          </div>
        </div>
        
        <div class="game-tags">
          ${this.gameData.tags.map(tag => `<span class="game-tag">${tag}</span>`).join('')}
        </div>
        
        ${this.gameData.features ? `
          <div class="game-features">
            <h3>Game Features</h3>
            <ul>
              ${this.gameData.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="play-options">
          <button class="play-gold-btn">
            Play with Gold Coins
            <span>Min bet: ${this.formatNumber(this.gameData.minBetGold)}</span>
          </button>
          
          <button class="play-sweep-btn">
            Play with Sweep Coins
            <span class="sweep-info">Min bet: ${this.gameData.minBetSweep.toFixed(2)}</span>
          </button>
        </div>
      </div>
    `;
    
    this.modal.appendChild(content);
    this.addEventListeners(content);
  }

  addEventListeners(content) {
    // Close button
    content.querySelector('.close-preview').addEventListener('click', () => this.hide());
    
    // Close on background click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
    
    // Play buttons
    content.querySelector('.play-gold-btn').addEventListener('click', () => {
      this.hide();
      this.gameData.onPlay('gold');
    });
    
    content.querySelector('.play-sweep-btn').addEventListener('click', () => {
      this.hide();
      this.gameData.onPlay('sweep');
    });
  }

  formatNumber(number) {
    return new Intl.NumberFormat().format(number);
  }
} 