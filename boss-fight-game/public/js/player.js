// Player Entity
class Player {
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
    this.image.src = CONFIG.ASSETS.PLAYER;
  }

  reset() {
    this.width = CONFIG.PLAYER.WIDTH;
    this.height = CONFIG.PLAYER.HEIGHT;
    this.x = 120;
    this.y = CONFIG.FLOOR_Y - this.height;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left

    this.hp = CONFIG.PLAYER.MAX_HP;
    this.stamina = CONFIG.PLAYER.MAX_STAMINA;

    this.onGround = true;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldownTimer = 0;
    this.hasHitThisAttack = false;

    this.isBlocking = false;

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;

    this.hurtTimer = 0;
    this.isDead = false;

    // Action telemetry for Gemini API (records last 3 meaningful actions)
    this.lastActions = ['idle'];
  }

  recordAction(action) {
    if (this.lastActions[this.lastActions.length - 1] !== action) {
      this.lastActions.push(action);
      if (this.lastActions.length > 3) {
        this.lastActions.shift();
      }
    }
  }

  getLastActions() {
    return [...this.lastActions];
  }

  update(dt, input, bossX) {
    if (this.isDead) return;

    // Update timers
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;

    // Natural stamina recovery (unless blocking or attacking)
    if (!this.isBlocking && !this.isAttacking && !this.isDashing) {
      this.stamina = Math.min(
        CONFIG.PLAYER.MAX_STAMINA,
        this.stamina + CONFIG.PLAYER.STAMINA_RECOVERY_RATE * dt
      );
    }

    // Auto-face towards boss if not locked in an action
    if (!this.isDashing && !this.isAttacking) {
      if (bossX !== undefined) {
        this.facing = bossX > this.x ? 1 : -1;
      }
    }

    // Handle Dash state
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.x += this.facing * CONFIG.PLAYER.DASH_SPEED * dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
      this._clampArenaBounds();
      return;
    }

    // Handle Attack state
    if (this.isAttacking) {
      this.attackTimer -= dt;
      this.vx = 0;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }

    // Handle Blocking state
    this.isBlocking = input.keys.block && this.stamina > 5;
    if (this.isBlocking) {
      this.recordAction('block');
      this.vx = 0; // Stationary while blocking
    }

    // Handle Dash Trigger
    if (input.consumeJustPressed('dash') && this.dashCooldownTimer <= 0 && this.stamina >= CONFIG.PLAYER.DASH_STAMINA_COST) {
      this.isDashing = true;
      this.dashTimer = CONFIG.PLAYER.DASH_DURATION;
      this.dashCooldownTimer = CONFIG.PLAYER.DASH_COOLDOWN;
      this.stamina -= CONFIG.PLAYER.DASH_STAMINA_COST;
      this.isAttacking = false;
      this.isBlocking = false;
      this.recordAction('dash');
      return;
    }

    // Handle Attack Trigger
    if (input.consumeJustPressed('attack') && !this.isAttacking && !this.isBlocking && this.attackCooldownTimer <= 0 && this.stamina >= CONFIG.PLAYER.ATTACK_STAMINA_COST) {
      this.isAttacking = true;
      this.attackTimer = CONFIG.PLAYER.ATTACK_DURATION;
      this.attackCooldownTimer = CONFIG.PLAYER.ATTACK_COOLDOWN;
      this.stamina -= CONFIG.PLAYER.ATTACK_STAMINA_COST;
      this.hasHitThisAttack = false;
      this.recordAction('attack');
    }

    // Handle Jump Trigger
    if (input.consumeJustPressed('jump') && this.onGround && !this.isAttacking && !this.isBlocking) {
      this.vy = -CONFIG.PLAYER.JUMP_FORCE;
      this.onGround = false;
      this.recordAction('jump');
    }

    // Horizontal Movement
    if (!this.isAttacking && !this.isBlocking) {
      if (input.keys.left && !input.keys.right) {
        this.vx = -CONFIG.PLAYER.SPEED;
        this.facing = -1;
        this.recordAction('move_left');
      } else if (input.keys.right && !input.keys.left) {
        this.vx = CONFIG.PLAYER.SPEED;
        this.facing = 1;
        this.recordAction('move_right');
      } else {
        this.vx = 0;
      }
    }

    // Apply Gravity and Vertical Velocity
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
  }

  _clampArenaBounds() {
    if (this.x < 20) this.x = 20;
    if (this.x > CONFIG.CANVAS_WIDTH - this.width - 20) {
      this.x = CONFIG.CANVAS_WIDTH - this.width - 20;
    }
  }

  getHitbox() {
    return {
      x: this.x + CONFIG.PLAYER.HITBOX.offsetX,
      y: this.y + CONFIG.PLAYER.HITBOX.offsetY,
      width: CONFIG.PLAYER.HITBOX.width,
      height: CONFIG.PLAYER.HITBOX.height
    };
  }

  getAttackHitbox() {
    if (!this.isAttacking || this.hasHitThisAttack) return null;
    const range = CONFIG.PLAYER.ATTACK_RANGE;
    return {
      x: this.facing === 1 ? this.x + this.width - 15 : this.x - range + 15,
      y: this.y + 15,
      width: range,
      height: this.height - 25
    };
  }

  takeDamage(amount, attackerX) {
    if (this.isDead) return { damage: 0, hit: false };

    // Invulnerability frames during dash-dodge
    if (this.isDashing) {
      return { damage: 0, hit: false, dodged: true };
    }

    let finalDamage = amount;
    let blocked = false;

    // Check directional block
    const attackerIsAhead = (this.facing === 1 && attackerX >= this.x) || (this.facing === -1 && attackerX <= this.x);
    if (this.isBlocking && attackerIsAhead) {
      blocked = true;
      finalDamage = Math.round(amount * (1 - CONFIG.PLAYER.BLOCK_DAMAGE_REDUCTION));
      this.stamina = Math.max(0, this.stamina - CONFIG.PLAYER.BLOCK_STAMINA_DRAIN_ON_HIT);
      if (this.stamina <= 0) {
        this.isBlocking = false; // Guard break
      }
    }

    this.hp = Math.max(0, this.hp - finalDamage);
    this.hurtTimer = 0.25;

    if (this.hp <= 0) {
      this.isDead = true;
    }

    return { damage: finalDamage, hit: true, blocked };
  }

  render(ctx) {
    ctx.save();

    // Hurt flash effect
    if (this.hurtTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }

    // Dash motion blur ghost effect
    if (this.isDashing) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(this.x - this.facing * 20, this.y, this.width, this.height);
      ctx.restore();
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
      // Fallback: draw sleek stylized warrior placeholder
      this._drawPlaceholder(ctx);
    }

    // Draw active attack slash arc effect
    if (this.isAttacking) {
      this._drawAttackSlash(ctx);
    }

    // Draw shield indicator when blocking
    if (this.isBlocking) {
      this._drawShield(ctx);
    }

    ctx.restore();
  }

  _drawPlaceholder(ctx) {
    const { x, y, width, height, facing } = this;

    // Body armor
    ctx.fillStyle = CONFIG.PLAYER.PLACEHOLDER_COLOR;
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 20, width - 20, height - 20, 6);
    ctx.fill();

    // Helmet / Head
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.roundRect(x + 14, y, width - 28, 22, 5);
    ctx.fill();

    // Visor slit
    ctx.fillStyle = '#0f172a';
    const visorX = facing === 1 ? x + width - 26 : x + 16;
    ctx.fillRect(visorX, y + 8, 10, 4);

    // Belt / detail
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 10, y + height - 32, width - 20, 6);

    // Direction indicator eye/glow
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(visorX + (facing === 1 ? 4 : 0), y + 9, 3, 2);
  }

  _drawAttackSlash(ctx) {
    const slashX = this.facing === 1 ? this.x + this.width + 5 : this.x - 25;
    const slashY = this.y + 15;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(slashX, slashY + 25, 30, this.facing === 1 ? -0.8 : 2.3, this.facing === 1 ? 0.8 : 3.9);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  _drawShield(ctx) {
    const shieldX = this.facing === 1 ? this.x + this.width - 5 : this.x - 15;
    const shieldY = this.y + 18;

    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(shieldX, shieldY + 25, 26, -1.2, 1.2, this.facing === -1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

window.Player = Player;
