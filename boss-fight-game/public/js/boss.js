// Boss Entity
class Boss {
  constructor() {
    this.reset();

    // Image asset handling
    this.image = new Image();
    this.imageLoaded = false;
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    this.image.onerror = () => {
      this.imageLoaded = false;
    };
    this.image.src = CONFIG.ASSETS.BOSS;
  }

  reset() {
    this.width = CONFIG.BOSS.WIDTH;
    this.height = CONFIG.BOSS.HEIGHT;
    this.x = CONFIG.CANVAS_WIDTH - 240;
    this.y = CONFIG.FLOOR_Y - this.height;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1; // 1 = right, -1 = left

    this.hp = CONFIG.BOSS.MAX_HP;
    this.phase = 1;

    this.onGround = true;
    this.state = 'idle'; // 'idle', 'moving', 'windup', 'active', 'recovery', 'dead'
    this.currentMove = null;
    this.moveTimer = 0;
    this.hurtTimer = 0;
    this.isDead = false;

    // Move telemetry
    this.lastMoves = [];

    // Active projectiles and effects
    this.fireballs = [];
    this.shockwaves = [];

    // Charge state
    this.isCharging = false;
    this.chargeDamageDealt = false;

    // Melee attack hit flag
    this.meleeHitDealt = false;
  }

  update(dt, playerX, playerY) {
    if (this.isDead) return;

    // Check phase transition
    if (this.phase === 1 && this.hp <= CONFIG.BOSS.PHASE2_HP_THRESHOLD) {
      this.phase = 2;
    }

    // Update hurt timer
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // Face towards player if not in locked charge or retreat
    if (this.state === 'idle' || this.state === 'moving' || (this.state === 'windup' && this.currentMove !== 'retreat')) {
      this.facing = playerX > this.x ? 1 : -1;
    }

    // Update active move lifecycle
    if (this.currentMove) {
      this._updateMoveLifecycle(dt, playerX);
    } else {
      // Natural idle tracking: drift slowly toward optimal spacing if idle
      this._updateIdleMovement(dt, playerX);
    }

    // Gravity and physics
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Arena Floor collision
    if (this.y >= CONFIG.FLOOR_Y - this.height) {
      this.y = CONFIG.FLOOR_Y - this.height;
      this.vy = 0;
      this.onGround = true;
    }

    this._clampArenaBounds();

    // Update projectiles
    this._updateProjectiles(dt);
  }

  _updateIdleMovement(dt, playerX) {
    const dist = Math.abs(playerX - this.x);
    const speed = this.phase === 2 ? CONFIG.BOSS.SPEED_PHASE2 : CONFIG.BOSS.SPEED_PHASE1;

    if (dist > 350) {
      // Walk closer
      this.vx = this.facing * speed * 0.7;
    } else if (dist < 100) {
      // Back off slightly
      this.vx = -this.facing * speed * 0.5;
    } else {
      this.vx = 0;
    }
  }

  executeMove(moveName, playerX) {
    if (this.isDead || this.currentMove) return;

    this.currentMove = moveName;
    this.state = 'windup';
    this.meleeHitDealt = false;
    this.chargeDamageDealt = false;

    const moveConfig = CONFIG.MOVES[moveName];

    // Phase 2 windups are slightly snappier
    const windupReduction = this.phase === 2 ? 0.8 : 1.0;

    switch (moveName) {
      case 'melee_slash':
        this.moveTimer = moveConfig.windup * windupReduction;
        this.vx = 0;
        break;

      case 'fireball':
        this.moveTimer = moveConfig.windup * windupReduction;
        this.vx = 0;
        break;

      case 'charge':
        this.moveTimer = moveConfig.windup * windupReduction;
        this.vx = 0;
        break;

      case 'ground_slam':
        this.moveTimer = moveConfig.leapTime;
        this.vy = -CONFIG.PLAYER.JUMP_FORCE * 1.1;
        this.onGround = false;
        // Leap slightly toward player
        this.vx = this.facing * (this.phase === 2 ? 260 : 180);
        break;

      case 'retreat':
        this.moveTimer = moveConfig.duration;
        this.state = 'active';
        this.vx = -this.facing * moveConfig.speed;
        this.vy = -200; // Small backward hop
        this.onGround = false;
        break;

      default:
        this.currentMove = null;
        this.state = 'idle';
        break;
    }

    // Record move history
    this.lastMoves.push(moveName);
    if (this.lastMoves.length > 2) {
      this.lastMoves.shift();
    }
  }

  _updateMoveLifecycle(dt, playerX) {
    this.moveTimer -= dt;

    if (this.state === 'windup') {
      if (this.moveTimer <= 0) {
        this.state = 'active';
        this._startActiveMovePhase(playerX);
      }
    } else if (this.state === 'active') {
      if (this.currentMove === 'charge') {
        const speed = CONFIG.MOVES.charge.speed * (this.phase === 2 ? 1.2 : 1.0);
        this.vx = this.facing * speed;
      }

      if (this.moveTimer <= 0) {
        this.state = 'recovery';
        const recoveryReduction = this.phase === 2 ? 0.75 : 1.0;
        const baseRecovery = CONFIG.MOVES[this.currentMove]?.recovery || 0.3;
        this.moveTimer = baseRecovery * recoveryReduction;
        this.vx = 0;
        this.isCharging = false;
      }
    } else if (this.state === 'recovery') {
      if (this.moveTimer <= 0) {
        this.currentMove = null;
        this.state = 'idle';
        this.vx = 0;
      }
    }
  }

  _startActiveMovePhase(playerX) {
    const moveConfig = CONFIG.MOVES[this.currentMove];

    switch (this.currentMove) {
      case 'melee_slash':
        this.moveTimer = moveConfig.active;
        // Quick lunge
        this.vx = this.facing * 180;
        break;

      case 'fireball':
        this.moveTimer = moveConfig.active;
        this._spawnFireball();
        break;

      case 'charge':
        this.isCharging = true;
        this.moveTimer = moveConfig.duration;
        break;

      case 'ground_slam':
        // Downward slam upon reaching apex
        this.vy = 850;
        this.moveTimer = 0.3;
        break;

      case 'retreat':
        // Retreat handled in initial execute
        break;
    }
  }

  _spawnFireball() {
    const spawnX = this.facing === 1 ? this.x + this.width + 10 : this.x - 10;
    const spawnY = this.y + this.height * 0.45;
    const speed = CONFIG.MOVES.fireball.projectileSpeed * (this.phase === 2 ? 1.25 : 1.0);

    this.fireballs.push({
      x: spawnX,
      y: spawnY,
      vx: this.facing * speed,
      radius: CONFIG.MOVES.fireball.radius,
      damage: CONFIG.MOVES.fireball.damage * (this.phase === 2 ? 1.2 : 1.0),
      active: true
    });
  }

  _triggerGroundSlamImpact() {
    const slamX = this.x + this.width / 2;
    const slamY = CONFIG.FLOOR_Y;
    const speed = CONFIG.MOVES.ground_slam.shockwaveSpeed;
    const damage = CONFIG.MOVES.ground_slam.shockwaveDamage;

    // Two shockwaves traveling left and right
    this.shockwaves.push(
      { x: slamX, y: slamY, vx: -speed, damage, lifetime: CONFIG.MOVES.ground_slam.shockwaveLifetime, active: true },
      { x: slamX, y: slamY, vx: speed, damage, lifetime: CONFIG.MOVES.ground_slam.shockwaveLifetime, active: true }
    );
  }

  _updateProjectiles(dt) {
    // Fireballs
    for (const fb of this.fireballs) {
      fb.x += fb.vx * dt;
      if (fb.x < -50 || fb.x > CONFIG.CANVAS_WIDTH + 50) {
        fb.active = false;
      }
    }
    this.fireballs = this.fireballs.filter(fb => fb.active);

    // Shockwaves
    for (const sw of this.shockwaves) {
      sw.x += sw.vx * dt;
      sw.lifetime -= dt;
      if (sw.lifetime <= 0 || sw.x < -50 || sw.x > CONFIG.CANVAS_WIDTH + 50) {
        sw.active = false;
      }
    }
    this.shockwaves = this.shockwaves.filter(sw => sw.active);
  }

  _clampArenaBounds() {
    if (this.x < 20) {
      this.x = 20;
      if (this.isCharging) this.moveTimer = 0; // End charge on wall
    }
    if (this.x > CONFIG.CANVAS_WIDTH - this.width - 20) {
      this.x = CONFIG.CANVAS_WIDTH - this.width - 20;
      if (this.isCharging) this.moveTimer = 0;
    }
  }

  getHitbox() {
    return {
      x: this.x + CONFIG.BOSS.HITBOX.offsetX,
      y: this.y + CONFIG.BOSS.HITBOX.offsetY,
      width: CONFIG.BOSS.HITBOX.width,
      height: CONFIG.BOSS.HITBOX.height
    };
  }

  getMeleeHitbox() {
    if (this.state !== 'active' || this.currentMove !== 'melee_slash' || this.meleeHitDealt) {
      return null;
    }
    const range = CONFIG.MOVES.melee_slash.range;
    return {
      x: this.facing === 1 ? this.x + this.width - 20 : this.x - range + 20,
      y: this.y + 20,
      width: range,
      height: this.height - 30,
      damage: CONFIG.MOVES.melee_slash.damage * (this.phase === 2 ? 1.25 : 1.0)
    };
  }

  getChargeHitbox() {
    if (!this.isCharging || this.chargeDamageDealt) return null;
    return {
      x: this.x,
      y: this.y + 15,
      width: this.width,
      height: this.height - 20,
      damage: CONFIG.MOVES.charge.damage * (this.phase === 2 ? 1.25 : 1.0)
    };
  }

  takeDamage(amount) {
    if (this.isDead) return 0;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtTimer = 0.22;

    if (this.hp <= 0) {
      this.isDead = true;
      this.currentMove = null;
      this.state = 'dead';
    }

    return amount;
  }

  render(ctx) {
    ctx.save();

    // Render shockwaves
    this._renderShockwaves(ctx);

    // Render fireballs
    this._renderFireballs(ctx);

    // Hurt flash
    if (this.hurtTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    // Phase 2 enraged aura
    if (this.phase === 2 && !this.isDead) {
      this._renderPhase2Aura(ctx);
    }

    // Telegraph / windup indicator
    if (this.state === 'windup') {
      this._renderTelegraph(ctx);
    }

    // Check if character sprite PNG exists and is loaded
    const hasValidImage = this.imageLoaded && this.image.complete && this.image.naturalWidth > 0;

    if (hasValidImage) {
      ctx.save();
      if (this.facing === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(this.image, -this.x - this.width, this.y, this.width, this.height);
      } else {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      }
      ctx.restore();
    } else {
      // Fallback: draw stylish dark warlock / demon overlord placeholder
      this._drawPlaceholder(ctx);
    }

    // Slash VFX during active melee
    if (this.state === 'active' && this.currentMove === 'melee_slash') {
      this._renderSlashVfx(ctx);
    }

    ctx.restore();
  }

  _drawPlaceholder(ctx) {
    const { x, y, width, height, facing } = this;
    const bodyColor = this.phase === 2 ? CONFIG.BOSS.PLACEHOLDER_COLOR_PHASE2 : CONFIG.BOSS.PLACEHOLDER_COLOR;

    // Cloak / Robe body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 25, width - 24, height - 25, 8);
    ctx.fill();

    // Shoulder Pauldrons
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 22, width - 12, 22, 6);
    ctx.fill();

    // Head / Mask
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.roundRect(x + 22, y + 2, width - 44, 28, 6);
    ctx.fill();

    // Horns
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(x + 26, y + 10);
    ctx.lineTo(x + 16, y - 10);
    ctx.lineTo(x + 32, y + 6);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + width - 26, y + 10);
    ctx.lineTo(x + width - 16, y - 10);
    ctx.lineTo(x + width - 32, y + 6);
    ctx.fill();

    // Glowing Eyes
    ctx.fillStyle = this.phase === 2 ? '#fbbf24' : '#ef4444';
    const eyeX = facing === 1 ? x + width - 38 : x + 28;
    ctx.fillRect(eyeX, y + 14, 8, 4);
  }

  _renderPhase2Aura(ctx) {
    ctx.save();
    const pulse = 10 + Math.sin(Date.now() / 120) * 5;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2 + pulse, this.height / 2 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
  }

  _renderTelegraph(ctx) {
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', this.x + this.width / 2, this.y - 14);
    ctx.restore();
  }

  _renderSlashVfx(ctx) {
    const slashX = this.facing === 1 ? this.x + this.width + 10 : this.x - 30;
    const slashY = this.y + 25;

    ctx.save();
    ctx.strokeStyle = this.phase === 2 ? '#f43f5e' : '#ef4444';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(slashX, slashY + 30, 45, this.facing === 1 ? -1 : 2.1, this.facing === 1 ? 1 : 4.1);
    ctx.stroke();
    ctx.restore();
  }

  _renderFireballs(ctx) {
    for (const fb of this.fireballs) {
      ctx.save();
      // Outer glow
      ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // Main fireball
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.radius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _renderShockwaves(ctx) {
    for (const sw of this.shockwaves) {
      ctx.save();
      const alpha = Math.max(0, sw.lifetime / CONFIG.MOVES.ground_slam.shockwaveLifetime);
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y - 12, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
}

window.Boss = Boss;
