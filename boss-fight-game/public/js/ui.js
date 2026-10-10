// UI and HUD Manager
class UIManager {
  constructor() {
    this.hudContainer = document.getElementById('hud-container');
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
    this.cinematicScreen = document.getElementById('cinematic-screen');
    this.cinematicCaption = document.getElementById('cinematic-caption');

    // Buttons
    this.startBtn = document.getElementById('start-btn');
    this.cinematicBtn = document.getElementById('cinematic-btn');
    this.skipCinematicBtn = document.getElementById('skip-cinematic-btn');
    this.restartLoseBtn = document.getElementById('restart-lose-btn');
    this.restartWinBtn = document.getElementById('restart-win-btn');

    // Pause Screen & Quality Settings
    this.pauseScreen = document.getElementById('pause-screen');
    this.resumeBtn = document.getElementById('resume-btn');
    this.restartPauseBtn = document.getElementById('restart-pause-btn');
    this.mainMenuBtn = document.getElementById('main-menu-btn');
    this.hudPauseBtn = document.getElementById('hud-pause-btn');
    this.qualityDesc = document.getElementById('quality-desc');
    this.qualityButtons = document.querySelectorAll('.btn-quality');

    this.currentQuality = localStorage.getItem('boss_fight_quality') || 'high';

    this.tauntTimer = null;
    this.cinematicInterval = null;
    this.isCinematicPlaying = false;
  }

  init(onStartGame, onRestartGame, onTogglePause, onQualityChange, onMainMenu) {
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.stopCinematic();
        this.hideAllScreens();
        onStartGame();
      });
    }

    if (this.cinematicBtn) {
      this.cinematicBtn.addEventListener('click', () => {
        this.playCinematic(onStartGame);
      });
    }

    if (this.skipCinematicBtn) {
      this.skipCinematicBtn.addEventListener('click', () => {
        this.stopCinematic();
        this.hideAllScreens();
        onStartGame();
      });
    }

    // Allow Space key to skip cinematic
    window.addEventListener('keydown', (e) => {
      if (this.isCinematicPlaying && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.stopCinematic();
        this.hideAllScreens();
        onStartGame();
      }
    });

    // Pause Controls
    if (this.hudPauseBtn) {
      this.hudPauseBtn.addEventListener('click', () => {
        if (onTogglePause) onTogglePause();
      });
    }

    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => {
        if (onTogglePause) onTogglePause();
      });
    }

    if (this.restartPauseBtn) {
      this.restartPauseBtn.addEventListener('click', () => {
        this.hidePauseMenu();
        onRestartGame();
      });
    }

    if (this.mainMenuBtn) {
      this.mainMenuBtn.addEventListener('click', () => {
        this.hidePauseMenu();
        if (onMainMenu) onMainMenu();
      });
    }

    // Quality Selector buttons
    this.qualityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.quality;
        this.setQuality(q, onQualityChange);
      });
    });

    this.setQuality(this.currentQuality, onQualityChange, false);

    if (this.restartLoseBtn) {
      this.restartLoseBtn.addEventListener('click', () => {
        this.stopCinematic();
        this.hideAllScreens();
        onRestartGame();
      });
    }

    if (this.restartWinBtn) {
      this.restartWinBtn.addEventListener('click', () => {
        this.stopCinematic();
        this.hideAllScreens();
        onRestartGame();
      });
    }
  }

  setQuality(level, callback, triggerCallback = true) {
    if (!CONFIG.QUALITY[level]) level = 'high';
    this.currentQuality = level;
    localStorage.setItem('boss_fight_quality', level);

    this.qualityButtons.forEach(btn => {
      if (btn.dataset.quality === level) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (this.qualityDesc && CONFIG.QUALITY[level]) {
      this.qualityDesc.textContent = CONFIG.QUALITY[level].label;
    }

    if (triggerCallback && callback) {
      callback(level);
    }
  }

  showPauseMenu() {
    if (this.pauseScreen) this.pauseScreen.classList.remove('hidden');
  }

  hidePauseMenu() {
    if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
  }

  playCinematic(onComplete) {
    this.hideAllScreens();
    this.isCinematicPlaying = true;
    if (this.cinematicScreen) this.cinematicScreen.classList.remove('hidden');

    const captions = [
      "Under the crimson Blood Moon, an ancient demon awakens...",
      "The Gemini Overlord watches every movement from the shadows...",
      "It learns from your habits. It counters your strikes.",
      "Draw your blade, Ronin. The duel begins now."
    ];

    let index = 0;
    if (this.cinematicCaption) this.cinematicCaption.textContent = captions[0];

    if (this.cinematicInterval) clearInterval(this.cinematicInterval);

    this.cinematicInterval = setInterval(() => {
      index++;
      if (index < captions.length) {
        if (this.cinematicCaption) {
          this.cinematicCaption.style.opacity = '0';
          setTimeout(() => {
            this.cinematicCaption.textContent = captions[index];
            this.cinematicCaption.style.opacity = '1';
          }, 300);
        }
      } else {
        this.stopCinematic();
        this.hideAllScreens();
        if (onComplete) onComplete();
      }
    }, 3400);
  }

  stopCinematic() {
    this.isCinematicPlaying = false;
    if (this.cinematicInterval) {
      clearInterval(this.cinematicInterval);
      this.cinematicInterval = null;
    }
    if (this.cinematicScreen) {
      this.cinematicScreen.classList.add('hidden');
    }
  }

  showStartScreen() {
    this.hideAllScreens();
    if (this.hudContainer) this.hudContainer.classList.add('hidden');
    if (this.startScreen) this.startScreen.classList.remove('hidden');
  }

  showGameOver() {
    this.hideAllScreens();
    if (this.hudContainer) this.hudContainer.classList.remove('hidden');
    if (this.gameOverScreen) this.gameOverScreen.classList.remove('hidden');
  }

  showVictory() {
    this.hideAllScreens();
    if (this.hudContainer) this.hudContainer.classList.remove('hidden');
    if (this.victoryScreen) this.victoryScreen.classList.remove('hidden');
  }

  hideAllScreens() {
    if (this.startScreen) this.startScreen.classList.add('hidden');
    if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');
    if (this.victoryScreen) this.victoryScreen.classList.add('hidden');
    if (this.cinematicScreen) this.cinematicScreen.classList.add('hidden');
    if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
    if (this.hudContainer) this.hudContainer.classList.remove('hidden');
  }

  updateHUD(player, boss) {
    // Player HP flash & update
    if (this.lastPlayerHp !== undefined && player.hp < this.lastPlayerHp) {
      if (this.playerHpFill) {
        this.playerHpFill.classList.add('damage-flash');
        setTimeout(() => {
          if (this.playerHpFill) this.playerHpFill.classList.remove('damage-flash');
        }, 160);
      }
    }
    this.lastPlayerHp = player.hp;

    const playerHpPct = Math.max(0, (player.hp / CONFIG.PLAYER.MAX_HP) * 100);
    if (this.playerHpFill) this.playerHpFill.style.width = `${playerHpPct}%`;
    if (this.playerHpText) this.playerHpText.textContent = `${Math.ceil(player.hp)} / ${CONFIG.PLAYER.MAX_HP}`;

    // Player Stamina
    const staminaPct = Math.max(0, (player.stamina / CONFIG.PLAYER.MAX_STAMINA) * 100);
    if (this.playerStaminaFill) this.playerStaminaFill.style.width = `${staminaPct}%`;

    // Boss HP flash & update
    if (this.lastBossHp !== undefined && boss.hp < this.lastBossHp) {
      if (this.bossHpFill) {
        this.bossHpFill.classList.add('damage-flash');
        setTimeout(() => {
          if (this.bossHpFill) this.bossHpFill.classList.remove('damage-flash');
        }, 160);
      }
    }
    this.lastBossHp = boss.hp;

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
    const bossTopY = Math.max(16, boss.y - 18);

    const screenX = rect.left + bossCenterX * scaleX;
    const screenY = rect.top + bossTopY * scaleY;

    this.tauntBubble.style.left = `${screenX}px`;
    this.tauntBubble.style.top = `${screenY}px`;
  }
}

window.UIManager = UIManager;
