// Boss AI Client Coordinator
class BossAIController {
  constructor(uiManager) {
    this.ui = uiManager;
    this.isRequestPending = false;
    this.lastRequestTimestamp = 0;
    this.minimumIntervalMs = 1250; // Respect 1.2s rate limit
    this.decisionTimer = 0;
  }

  update(dt, boss, player) {
    if (boss.isDead || player.isDead) return;

    this.decisionTimer += dt;

    // Trigger AI decision if boss is idle and either ~2 seconds elapsed or boss finished move
    const shouldDecide = !boss.currentMove && (this.decisionTimer >= 2.0 || boss.state === 'idle');

    if (shouldDecide && !this.isRequestPending) {
      const now = Date.now();
      if (now - this.lastRequestTimestamp >= this.minimumIntervalMs) {
        this.decisionTimer = 0;
        this.fetchMoveDecision(boss, player);
      }
    }
  }

  async fetchMoveDecision(boss, player) {
    if (this.isRequestPending || boss.isDead || player.isDead) return;

    this.isRequestPending = true;
    this.lastRequestTimestamp = Date.now();

    const distance = Math.abs(boss.x - player.x);
    const payload = {
      bossHp: boss.hp,
      playerHp: player.hp,
      stamina: player.stamina,
      distance: Math.round(distance),
      bossPhase: boss.phase,
      lastPlayerActions: player.getLastActions(),
      lastBossMoves: boss.lastMoves
    };

    // Client-side 1.8s safety timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    try {
      const response = await fetch('/api/boss-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      this._applyDecision(data, boss, player);

    } catch (err) {
      clearTimeout(timeoutId);
      // Immediate client-side fallback to prevent any stalling
      const localFallback = this._getLocalFallback(payload);
      this._applyDecision(localFallback, boss, player);
    } finally {
      this.isRequestPending = false;
    }
  }

  _applyDecision(decision, boss, player) {
    const move = decision?.move || 'melee_slash';
    const taunt = decision?.taunt || 'Prepare for defeat!';
    const source = decision?.source === 'gemini' ? 'Gemini AI' : 'Fallback AI';

    // Update UI
    if (this.ui) {
      this.ui.setAiBadge(source);
      this.ui.showBossTaunt(taunt);
    }

    // Execute move on boss
    boss.executeMove(move, player.x);
  }

  _getLocalFallback(payload) {
    const { distance = 200, lastPlayerActions = [] } = payload;
    const lastAction = lastPlayerActions[lastPlayerActions.length - 1];

    let move = 'melee_slash';
    if (distance < 120) {
      move = lastAction === 'block' ? 'ground_slam' : 'melee_slash';
    } else if (distance < 280) {
      move = Math.random() > 0.5 ? 'charge' : 'fireball';
    } else {
      move = Math.random() > 0.4 ? 'fireball' : 'charge';
    }

    return {
      move,
      taunt: 'You cannot triumph!',
      source: 'fallback'
    };
  }
}

window.BossAIController = BossAIController;
