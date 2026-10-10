// Player Entity
class Player {
  constructor() {
    this.reset();

    // Primary idle asset
    this.image = new Image();
    this.imageLoaded = false;
    this.image.onload = () => { this.imageLoaded = true; };
    this.image.onerror = () => { this.imageLoaded = false; };
    this.image.src = CONFIG.ASSETS.PLAYER;

    // Run animation strip
    this.runImg = new Image();
    this.runImgLoaded = false;
    this.runImg.onload = () => { this.runImgLoaded = true; };
    this.runImg.src = 'assets/characters/player_run.png';

    // Attack animation strip
    this.attackImg = new Image();
    this.attackImgLoaded = false;
    this.attackImg.onload = () => { this.attackImgLoaded = true; };
    this.attackImg.src = 'assets/characters/player_attack.png';

    // Jump animation strip
    this.jumpImg = new Image();
    this.jumpImgLoaded = false;
    this.jumpImg.onload = () => { this.jumpImgLoaded = true; };
    this.jumpImg.src = 'assets/characters/player_jump.png';

    // Fall animation strip
    this.fallImg = new Image();
    this.fallImgLoaded = false;
    this.fallImg.onload = () => { this.fallImgLoaded = true; };
    this.fallImg.src = 'assets/characters/player_fall.png';
  }

  reset() {
    this.width = CONFIG.PLAYER.WIDTH;
    this.height = CONFIG.PLAYER.HEIGHT;
    this.x = 80;
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
    const prevY = this.y;
    this.y += this.vy * dt;

    // Platform and floor collision
    this.onGround = false;

    // Check elevated platforms (one-way from above, unless pressing down)
    if (CONFIG.PLATFORMS && this.vy >= 0 && !input.keys.down) {
      for (const p of CONFIG.PLATFORMS) {
        const feetPrev = prevY + this.height;
        const feetCurr = this.y + this.height;
        const inPlatformX = (this.x + this.width * 0.8 > p.x) && (this.x + this.width * 0.2 < p.x + p.width);
        if (inPlatformX && feetPrev <= p.y + 22 && feetCurr >= p.y) {
          this.y = p.y - this.height;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    }

    // Arena Floor collision
    if (!this.onGround && this.y >= CONFIG.FLOOR_Y - this.height) {
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
      x: this.facing === 1 ? this.x + this.width - 25 : this.x - range + 25,
      y: this.y + 20,
      width: range,
      height: this.height - 35
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
      ctx.fillRect(this.x - this.facing * 30, this.y, this.width, this.height);
      ctx.restore();
    }

    // Select active sprite based on player combat and movement state
    let activeImg = this.image;
    let isValid = this.imageLoaded && this.image.complete && this.image.naturalWidth > 0;
    let frameRate = 130;

    if (this.isAttacking && this.attackImgLoaded && this.attackImg.complete && this.attackImg.naturalWidth > 0) {
      activeImg = this.attackImg;
      isValid = true;
    } else if (!this.onGround) {
      if (this.vy < 0 && this.jumpImgLoaded && this.jumpImg.complete && this.jumpImg.naturalWidth > 0) {
        activeImg = this.jumpImg;
        isValid = true;
      } else if (this.vy >= 0 && this.fallImgLoaded && this.fallImg.complete && this.fallImg.naturalWidth > 0) {
        activeImg = this.fallImg;
        isValid = true;
      } else if (this.jumpImgLoaded && this.jumpImg.complete && this.jumpImg.naturalWidth > 0) {
        activeImg = this.jumpImg;
        isValid = true;
      }
    } else if (Math.abs(this.vx) > 10 && this.runImgLoaded && this.runImg.complete && this.runImg.naturalWidth > 0) {
      activeImg = this.runImg;
      isValid = true;
      frameRate = 85;
    }

    if (isValid) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // Render crisp, distinct pixel art at 260x310

      const nw = activeImg.naturalWidth;
      const nh = activeImg.naturalHeight;
      let sx = 0, sy = 0, sWidth = nw, sHeight = nh;

      // Slicing animation frames for sprite strips
      if (nw > nh * 1.3) {
        const numFrames = Math.max(1, Math.round(nw / nh));
        const frameW = nw / numFrames;
        let currentFrame = 0;

        if (this.isAttacking) {
          const progress = Math.max(0, Math.min(1, 1 - (this.attackTimer / CONFIG.PLAYER.ATTACK_DURATION)));
          currentFrame = Math.min(numFrames - 1, Math.floor(progress * numFrames));
        } else {
          currentFrame = Math.floor(Date.now() / frameRate) % numFrames;
        }

        sx = currentFrame * frameW;
        sWidth = frameW;
      }

      if (this.facing === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(activeImg, sx, sy, sWidth, sHeight, -this.x - this.width, this.y, this.width, this.height);
      } else {
        ctx.drawImage(activeImg, sx, sy, sWidth, sHeight, this.x, this.y, this.width, this.height);
      }
      ctx.restore();
    } else {
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
    ctx.roundRect(x + 20, y + 40, width - 40, height - 40, 10);
    ctx.fill();

    // Helmet / Head
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.roundRect(x + 35, y + 10, width - 70, 45, 8);
    ctx.fill();

    // Visor slit
    ctx.fillStyle = '#0f172a';
    const visorX = facing === 1 ? x + width - 55 : x + 35;
    ctx.fillRect(visorX, y + 25, 20, 8);

    // Direction indicator eye/glow
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(visorX + (facing === 1 ? 8 : 2), y + 27, 6, 4);
  }

  _drawAttackSlash(ctx) {
    const slashX = this.facing === 1 ? this.x + this.width + 12 : this.x - 32;
    const slashY = this.y + this.height * 0.38;
    const startAngle = this.facing === 1 ? -0.9 : 2.2;
    const endAngle = this.facing === 1 ? 0.9 : 4.0;

    ctx.save();
    ctx.lineCap = 'round';

    // 1. Ghost speed trails trailing behind the strike
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(slashX - this.facing * 24, slashY, 68, startAngle, endAngle);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(slashX - this.facing * 12, slashY, 74, startAngle, endAngle);
    ctx.stroke();

    // 2. Wide outer celestial glow
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(slashX, slashY, 80, startAngle, endAngle);
    ctx.stroke();

    // 3. Razor cyan energy blade body
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(slashX, slashY, 80, startAngle, endAngle);
    ctx.stroke();

    // 4. Pure white scorching cutting edge
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(slashX, slashY, 80, startAngle, endAngle);
    ctx.stroke();

    // 5. Radiant blade tip gleam starburst
    const tipAngle = this.facing === 1 ? endAngle : startAngle;
    const tipX = slashX + Math.cos(tipAngle) * 80;
    const tipY = slashY + Math.sin(tipAngle) * 80;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cross star flare at blade tip
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tipX - 9, tipY);
    ctx.lineTo(tipX + 9, tipY);
    ctx.moveTo(tipX, tipY - 9);
    ctx.lineTo(tipX, tipY + 9);
    ctx.stroke();

    ctx.restore();
  }

  _drawShield(ctx) {
    const shieldX = this.facing === 1 ? this.x + this.width - 15 : this.x + 15;
    const shieldY = this.y + this.height * 0.35;

    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(shieldX, shieldY, 55, -1.2, 1.2, this.facing === -1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

window.Player = Player;
