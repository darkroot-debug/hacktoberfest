// UI and HUD Manager
class UIManager {
  constructor() {
    // HUD Elements
    this.playerHpFill = document.getElementById('player-hp-fill');
    this.playerHpText = document.getElementById('player-hp-text');
    this.playerStaminaFill = document.getElementById('player-stamina-fill');
    
    this.bossHpFill = document.getElementById('boss-hp-fill');
    this.bossHpText = document.getElementById('boss-hp-text');
    this.bossPhaseBadge = document.getElementById('boss-phase-badge');
    
    this.aiBadge = document.getElementById('ai-status-badge');
    this.tauntBubble = document.getElementById('taunt-bubble');
    this.tauntText = document.getElementById('taunt-text');

    // Screen Overlays
    this.startScreen = document.getElementById('start-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.victoryScreen = document.getElementById('victory-screen');

    // Buttons
    this.startBtn = document.getElementById('start-btn');
    this.restartLoseBtn = document.getElementById('restart-lose-btn');
    this.restartWinBtn = document.getElementById('restart-win-btn');

    this.tauntTimer = null;
  }

  init(onStartGame, onRestartGame) {
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.hideAllScreens();
        onStartGame();
      });
    }

    if (this.restartLoseBtn) {
      this.restartLoseBtn.addEventListener('click', () => {
        this.hideAllScreens();
        onRestartGame();
      });
    }

    if (this.restartWinBtn) {
      this.restartWinBtn.addEventListener('click', () => {
        this.hideAllScreens();
        onRestartGame();
      });
    }
  }

  showStartScreen() {
    this.hideAllScreens();
    if (this.startScreen) this.startScreen.classList.remove('hidden');
  }

  showGameOver() {
    this.hideAllScreens();
    if (this.gameOverScreen) this.gameOverScreen.classList.remove('hidden');
  }

  showVictory() {
    this.hideAllScreens();
    if (this.victoryScreen) this.victoryScreen.classList.remove('hidden');
  }

  hideAllScreens() {
    if (this.startScreen) this.startScreen.classList.add('hidden');
    if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');
    if (this.victoryScreen) this.victoryScreen.classList.add('hidden');
  }

  updateHUD(player, boss) {
    // Player HP
    const playerHpPct = Math.max(0, (player.hp / CONFIG.PLAYER.MAX_HP) * 100);
    if (this.playerHpFill) this.playerHpFill.style.width = `${playerHpPct}%`;
    if (this.playerHpText) this.playerHpText.textContent = `${Math.ceil(player.hp)} / ${CONFIG.PLAYER.MAX_HP}`;

    // Player Stamina
    const staminaPct = Math.max(0, (player.stamina / CONFIG.PLAYER.MAX_STAMINA) * 100);
    if (this.playerStaminaFill) this.playerStaminaFill.style.width = `${staminaPct}%`;

    // Boss HP
    const bossHpPct = Math.max(0, (boss.hp / CONFIG.BOSS.MAX_HP) * 100);
    if (this.bossHpFill) this.bossHpFill.style.width = `${bossHpPct}%`;
    if (this.bossHpText) this.bossHpText.textContent = `${Math.ceil(boss.hp)} / ${CONFIG.BOSS.MAX_HP}`;

    // Boss Phase Badge
    if (this.bossPhaseBadge) {
      if (boss.phase === 2) {
        this.bossPhaseBadge.textContent = 'PHASE 2 - ENRAGED';
        this.bossPhaseBadge.className = 'phase-badge phase-2';
      } else {
        this.bossPhaseBadge.textContent = 'PHASE 1';
        this.bossPhaseBadge.className = 'phase-badge phase-1';
      }
    }
  }

  setAiBadge(type) {
    if (!this.aiBadge) return;
    if (type === 'Gemini AI') {
      this.aiBadge.textContent = 'Gemini AI';
      this.aiBadge.className = 'ai-badge badge-gemini';
    } else {
      this.aiBadge.textContent = 'Fallback AI';
      this.aiBadge.className = 'ai-badge badge-fallback';
    }
  }

  showBossTaunt(text) {
    if (!this.tauntBubble || !this.tauntText) return;

    this.tauntText.textContent = `"${text}"`;
    this.tauntBubble.classList.remove('hidden');
    this.tauntBubble.classList.add('visible');

    if (this.tauntTimer) clearTimeout(this.tauntTimer);

    // Auto-dismiss after 2.6 seconds
    this.tauntTimer = setTimeout(() => {
      this.tauntBubble.classList.remove('visible');
      this.tauntBubble.classList.add('hidden');
    }, 2600);
  }

  updateTauntBubblePosition(boss, canvasElement) {
    if (!this.tauntBubble || this.tauntBubble.classList.contains('hidden')) return;

    // Convert canvas coordinates to DOM coordinates
    const rect = canvasElement.getBoundingClientRect();
    const scaleX = rect.width / CONFIG.CANVAS_WIDTH;
    const scaleY = rect.height / CONFIG.CANVAS_HEIGHT;

    const bossCenterX = boss.x + boss.width / 2;
    const bossTopY = boss.y - 20;

    const screenX = rect.left + bossCenterX * scaleX;
    const screenY = rect.top + bossTopY * scaleY;

    this.tauntBubble.style.left = `${screenX}px`;
    this.tauntBubble.style.top = `${screenY}px`;
  }
}

window.UIManager = UIManager;
