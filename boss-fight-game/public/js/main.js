// Main Game Loop and State Management
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = CONFIG.CANVAS_WIDTH;
  canvas.height = CONFIG.CANVAS_HEIGHT;

  // Initialize Subsystems
  const input = new InputManager();
  const ui = new UIManager();
  const player = new Player();
  const boss = new Boss();
  const ai = new BossAIController(ui);

  // Background Image Handling
  const bgImage = new Image();
  let bgImageLoaded = false;
  bgImage.onload = () => { bgImageLoaded = true; };
  bgImage.onerror = () => { bgImageLoaded = false; };
  bgImage.src = CONFIG.ASSETS.BACKGROUND;

  let gameState = 'start'; // 'start', 'playing', 'gameover', 'victory'
  let isPaused = false;
  let lastTime = performance.now();
  let screenShakeTimer = 0;
  let screenShakeIntensity = 0;

  // Graphics Quality Management
  let currentQuality = ui.currentQuality || 'high';
  const canvasContainer = document.getElementById('canvas-container');

  function applyQuality(qualityLevel) {
    if (!CONFIG.QUALITY[qualityLevel]) qualityLevel = 'high';
    currentQuality = qualityLevel;
    const settings = CONFIG.QUALITY[qualityLevel];

    const baseW = CONFIG.CANVAS_WIDTH;
    const baseH = CONFIG.CANVAS_HEIGHT;
    const scale = settings.resolutionScale;

    canvas.width = Math.round(baseW * scale);
    canvas.height = Math.round(baseH * scale);

    ctx.imageSmoothingEnabled = !settings.pixelated;

    if (canvasContainer) {
      canvasContainer.className = `canvas-container quality-${qualityLevel}`;
    }
  }

  // Damage popup numbers
  let damagePopups = [];

  function addDamagePopup(x, y, text, color = '#ffffff', fontSize = 16) {
    damagePopups.push({
      x,
      y,
      text,
      color,
      fontSize,
      timer: 0.85,
      vy: -55
    });
  }

  // Attack Clash Particles & Shockwaves
  let clashParticles = [];
  let clashShockwaves = [];
  let hitStopTimer = 0;

  function triggerClashImpact(x, y, type) {
    // 1. Expanding shockwave ring
    clashShockwaves.push({
      x,
      y,
      radius: 14,
      maxRadius: type === 'charge' ? 95 : 75,
      alpha: 1.0,
      color: type === 'fireball' ? '#f97316' : '#fbbf24',
      lineWidth: 5
    });

    // 2. High-speed radiant spark burst (28-36 particles)
    const particleCount = type === 'charge' ? 36 : 28;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 180 + Math.random() * 320;
      const colors = ['#ffffff', '#fbbf24', '#38bdf8', '#f43f5e', '#fef08a'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      clashParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        radius: 2.5 + Math.random() * 2.5,
        color,
        lifetime: 0.35 + Math.random() * 0.35,
        maxLife: 0.7
      });
    }
  }

  function updateClashEffects(dt) {
    // Shockwaves
    for (const sw of clashShockwaves) {
      sw.radius += (sw.maxRadius - sw.radius) * 12 * dt;
      sw.alpha -= dt * 2.2;
    }
    clashShockwaves = clashShockwaves.filter(sw => sw.alpha > 0);

    // Sparks
    for (const p of clashParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += CONFIG.GRAVITY * 0.4 * dt;
      p.lifetime -= dt;
    }
    clashParticles = clashParticles.filter(p => p.lifetime > 0);
  }

  function renderClashEffects() {
    // Shockwaves
    for (const sw of clashShockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = sw.lineWidth;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Radiant core flare
      ctx.fillStyle = `rgba(255, 255, 255, ${sw.alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, 14 * sw.alpha, 0, Math.PI * 2);
      ctx.fill();

      // Radiant cross star
      ctx.strokeStyle = `rgba(254, 240, 138, ${sw.alpha})`;
      ctx.lineWidth = 3;
      const ray = 26 * sw.alpha;
      ctx.beginPath();
      ctx.moveTo(sw.x - ray, sw.y);
      ctx.lineTo(sw.x + ray, sw.y);
      ctx.moveTo(sw.x, sw.y - ray);
      ctx.lineTo(sw.x, sw.y + ray);
      ctx.stroke();

      ctx.restore();
    }

    // Sparks
    for (const p of clashParticles) {
      ctx.save();
      const alpha = Math.max(0, p.lifetime / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function triggerScreenShake(duration, intensity) {
    const qSettings = CONFIG.QUALITY[currentQuality] || CONFIG.QUALITY.high;
    if (!qSettings.screenShake) return;
    screenShakeTimer = duration;
    screenShakeIntensity = intensity;
  }

  function checkAABB(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  function checkCircleBox(circle, box) {
    const closestX = Math.max(box.x, Math.min(circle.x, box.x + box.width));
    const closestY = Math.max(box.y, Math.min(circle.y, box.y + box.height));
    const distX = circle.x - closestX;
    const distY = circle.y - closestY;
    return distX * distX + distY * distY < circle.radius * circle.radius;
  }

  function togglePause() {
    if (gameState !== 'playing') return;
    isPaused = !isPaused;
    if (isPaused) {
      ui.showPauseMenu();
    } else {
      ui.hidePauseMenu();
    }
  }

  function handleMainMenu() {
    isPaused = false;
    gameState = 'start';
    ui.showStartScreen();
  }

  function startGame() {
    isPaused = false;
    ui.hidePauseMenu();
    player.reset();
    boss.reset();
    damagePopups = [];
    screenShakeTimer = 0;
    gameState = 'playing';
    ui.setAiBadge('Gemini AI');
    ui.updateHUD(player, boss);
  }

  function restartGame() {
    startGame();
  }

  ui.init(startGame, restartGame, togglePause, applyQuality, handleMainMenu);
  applyQuality(currentQuality);
  ui.showStartScreen();

  function update(dt) {
    // Handle pause key toggle (Esc or P)
    if (input.consumeJustPressed('pause')) {
      togglePause();
    }

    if (gameState !== 'playing' || isPaused) {
      input.resetFrameTriggers();
      return;
    }

    // Always update visual clash effects and popups
    updateClashEffects(dt);

    for (const pop of damagePopups) {
      pop.timer -= dt;
      pop.y += pop.vy * dt;
    }
    damagePopups = damagePopups.filter(pop => pop.timer > 0);

    // Hit stop freeze frame for combat impact punchiness
    if (hitStopTimer > 0) {
      hitStopTimer -= dt;
      input.resetFrameTriggers();
      return;
    }

    // Update screen shake
    if (screenShakeTimer > 0) {
      screenShakeTimer -= dt;
    }

    // Update player and boss
    player.update(dt, input, boss.x);
    boss.update(dt, player.x, player.y);

    // AI decision update
    ai.update(dt, boss, player);

    // -------------------------------------------------------------
    // 1. ATTACK-VS-ATTACK CLASH DETECTION
    // When Villain & Hero attacks touch, a dramatic weapon clash occurs
    // with distinct differential damage applied to both health bars!
    // -------------------------------------------------------------
    const attackBox = player.getAttackHitbox();
    const meleeBox = boss.getMeleeHitbox();
    const chargeBox = boss.getChargeHitbox();

    let clashOccurred = false;

    // A) Blade-on-Blade Clash (Hero Katana vs Boss Melee Slash)
    if (attackBox && !player.hasHitThisAttack && meleeBox && !boss.meleeHitDealt) {
      if (checkAABB(attackBox, meleeBox)) {
        clashOccurred = true;
        player.hasHitThisAttack = true;
        boss.meleeHitDealt = true;

        const clashX = (attackBox.x + attackBox.width / 2 + meleeBox.x + meleeBox.width / 2) / 2;
        const clashY = (attackBox.y + attackBox.height / 2 + meleeBox.y + meleeBox.height / 2) / 2;

        const cCfg = CONFIG.CLASH.BLADE_CLASH;
        const bossDmg = boss.takeDamage(cCfg.bossDamage);
        const playerResult = player.takeDamage(cCfg.playerDamage, boss.x);

        // Recoil knockbacks away from the clash
        boss.vx = -boss.facing * cCfg.recoilBoss;
        player.vx = -player.facing * cCfg.recoilPlayer;

        // Visual impact, screen shake & hit-stop
        triggerClashImpact(clashX, clashY, 'blade');
        triggerScreenShake(cCfg.shakeDuration, cCfg.shakeIntensity);
        hitStopTimer = 0.08;

        // Floating popups showing difference in health bars
        addDamagePopup(clashX, clashY - 26, '⚔️ BLADE CLASH! ⚔️', '#fbbf24', 20);
        addDamagePopup(boss.x + boss.width / 2, boss.y + 10, `-${bossDmg} Clash`, '#38bdf8', 18);
        addDamagePopup(player.x + player.width / 2, player.y + 10, `-${playerResult.damage} Recoil`, '#f43f5e', 18);

        if (boss.isDead) {
          gameState = 'victory';
          ui.showVictory();
        } else if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // B) Hero Katana Slash vs Boss Charge Counter
    if (!clashOccurred && attackBox && !player.hasHitThisAttack && chargeBox && !boss.chargeDamageDealt) {
      if (checkAABB(attackBox, chargeBox)) {
        clashOccurred = true;
        player.hasHitThisAttack = true;
        boss.chargeDamageDealt = true;
        boss.isCharging = false;
        boss.moveTimer = 0; // Interrupt charge

        const clashX = (attackBox.x + attackBox.width / 2 + chargeBox.x + chargeBox.width / 2) / 2;
        const clashY = (attackBox.y + attackBox.height / 2 + chargeBox.y + chargeBox.height / 2) / 2;

        const cCfg = CONFIG.CLASH.CHARGE_CLASH;
        const bossDmg = boss.takeDamage(cCfg.bossDamage);
        const playerResult = player.takeDamage(cCfg.playerDamage, boss.x);

        boss.vx = -boss.facing * cCfg.recoilBoss;
        player.vx = -player.facing * cCfg.recoilPlayer;

        triggerClashImpact(clashX, clashY, 'charge');
        triggerScreenShake(cCfg.shakeDuration, cCfg.shakeIntensity);
        hitStopTimer = 0.1;

        addDamagePopup(clashX, clashY - 26, '⚔️ CHARGE COUNTERED! ⚔️', '#f59e0b', 20);
        addDamagePopup(boss.x + boss.width / 2, boss.y + 10, `-${bossDmg} Countered!`, '#38bdf8', 18);
        addDamagePopup(player.x + player.width / 2, player.y + 10, `-${playerResult.damage} Recoil`, '#f43f5e', 18);

        if (boss.isDead) {
          gameState = 'victory';
          ui.showVictory();
        } else if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // C) Hero Katana Slash vs Boss Fireball (Fireball Slicing)
    if (attackBox && !player.hasHitThisAttack) {
      for (const fb of boss.fireballs) {
        if (fb.active && checkCircleBox(fb, attackBox)) {
          fb.active = false;
          player.hasHitThisAttack = true;

          const clashX = fb.x;
          const clashY = fb.y;

          const cCfg = CONFIG.CLASH.FIREBALL_CLASH;
          const bossDmg = boss.takeDamage(cCfg.bossDamage);
          const playerResult = player.takeDamage(cCfg.playerDamage, boss.x);

          player.vx = -player.facing * cCfg.recoilPlayer;

          triggerClashImpact(clashX, clashY, 'fireball');
          triggerScreenShake(cCfg.shakeDuration, cCfg.shakeIntensity);
          hitStopTimer = 0.06;

          addDamagePopup(clashX, clashY - 22, '🔥 FIREBALL SLICED! 🔥', '#f97316', 19);
          addDamagePopup(boss.x + boss.width / 2, boss.y + 10, `-${bossDmg} Backfire`, '#38bdf8', 16);
          addDamagePopup(player.x + player.width / 2, player.y + 10, `-${playerResult.damage} Singe`, '#fbbf24', 16);

          if (boss.isDead) {
            gameState = 'victory';
            ui.showVictory();
          } else if (player.isDead) {
            gameState = 'gameover';
            ui.showGameOver();
          }
          break;
        }
      }
    }

    // -------------------------------------------------------------
    // 2. STANDARD BODY HIT CHECKS (If not clashed)
    // -------------------------------------------------------------
    // Check Player attack hitting Boss body
    if (attackBox && !player.hasHitThisAttack) {
      const bossHitbox = boss.getHitbox();
      if (checkAABB(attackBox, bossHitbox)) {
        player.hasHitThisAttack = true;
        const dealt = boss.takeDamage(CONFIG.PLAYER.ATTACK_DAMAGE);
        addDamagePopup(boss.x + boss.width / 2, boss.y + 10, `-${dealt}`, '#38bdf8', 18);
        triggerScreenShake(0.14, 5);

        if (boss.isDead) {
          gameState = 'victory';
          ui.showVictory();
        }
      }
    }

    // Check Boss Melee Slash hitting Player body
    if (meleeBox && !boss.meleeHitDealt) {
      const playerHitbox = player.getHitbox();
      if (checkAABB(meleeBox, playerHitbox)) {
        boss.meleeHitDealt = true;
        const result = player.takeDamage(meleeBox.damage, boss.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#ef4444', 18);
          triggerScreenShake(0.2, result.blocked ? 3 : 7);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8', 16);
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Charge hitting Player body
    if (chargeBox && !boss.chargeDamageDealt) {
      const playerHitbox = player.getHitbox();
      if (checkAABB(chargeBox, playerHitbox)) {
        boss.chargeDamageDealt = true;
        const result = player.takeDamage(chargeBox.damage, boss.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#ef4444', 18);
          triggerScreenShake(0.25, result.blocked ? 4 : 9);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8', 16);
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Fireballs hitting Player body
    const playerHitbox = player.getHitbox();
    for (const fb of boss.fireballs) {
      if (fb.active && checkCircleBox(fb, playerHitbox)) {
        fb.active = false;
        const result = player.takeDamage(fb.damage, fb.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#f97316', 17);
          triggerScreenShake(0.18, 5);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8', 16);
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Shockwaves hitting Player body
    for (const sw of boss.shockwaves) {
      if (sw.active) {
        const swBox = { x: sw.x - 20, y: sw.y - 25, width: 40, height: 25 };
        if (checkAABB(swBox, playerHitbox)) {
          sw.active = false;
          const result = player.takeDamage(sw.damage, sw.x);
          if (result.hit) {
            addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, '#ef4444', 17);
            triggerScreenShake(0.2, 6);
          } else if (result.dodged) {
            addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8', 16);
          }

          if (player.isDead) {
            gameState = 'gameover';
            ui.showGameOver();
          }
        }
      }
    }

    // Update UI HUD
    ui.updateHUD(player, boss);
    ui.updateTauntBubblePosition(boss, canvas);

    input.resetFrameTriggers();
  }

  function renderArenaBackground() {
    const hasValidBg = bgImageLoaded && bgImage.complete && bgImage.naturalWidth > 0;

    if (hasValidBg) {
      // Draw battlefield background image
      ctx.drawImage(bgImage, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Subtle atmospheric grading for battle contrast
      const ambientOverlay = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
      ambientOverlay.addColorStop(0, 'rgba(10, 13, 20, 0.25)');
      ambientOverlay.addColorStop(0.65, 'rgba(10, 13, 20, 0.05)');
      ambientOverlay.addColorStop(1, 'rgba(10, 13, 20, 0.35)');
      ctx.fillStyle = ambientOverlay;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Subtle ground contact line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, CONFIG.FLOOR_Y);
      ctx.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.FLOOR_Y);
      ctx.stroke();
    } else {
      // Fallback: Ambient dark arena sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CONFIG.FLOOR_Y);
      skyGrad.addColorStop(0, '#090d16');
      skyGrad.addColorStop(0.6, '#111827');
      skyGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

      // Background gothic pillars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      const pillarWidth = 44;
      const spacing = 160;
      for (let x = 60; x < CONFIG.CANVAS_WIDTH; x += spacing) {
        ctx.fillRect(x, 40, pillarWidth, CONFIG.FLOOR_Y - 40);
        // Arch tops
        ctx.beginPath();
        ctx.arc(x + pillarWidth / 2, 40, pillarWidth / 2, Math.PI, 0);
        ctx.fill();
      }

      // Floor Base
      const floorGrad = ctx.createLinearGradient(0, CONFIG.FLOOR_Y, 0, CONFIG.CANVAS_HEIGHT);
      floorGrad.addColorStop(0, '#1e293b');
      floorGrad.addColorStop(0.1, '#0f172a');
      floorGrad.addColorStop(1, '#020617');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, CONFIG.FLOOR_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.FLOOR_Y);

      // Floor highlight edge line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, CONFIG.FLOOR_Y);
      ctx.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.FLOOR_Y);
      ctx.stroke();

      // Floor grid tiles
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 30; x < CONFIG.CANVAS_WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, CONFIG.FLOOR_Y);
        ctx.lineTo(x + 20, CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
      }
    }
  }

  function renderDamagePopups() {
    for (const pop of damagePopups) {
      ctx.save();
      const fSize = pop.fontSize || 16;
      ctx.font = `bold ${fSize}px "Inter", sans-serif`;
      ctx.fillStyle = pop.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  function renderPlatforms() {
    if (!CONFIG.PLATFORMS || !CONFIG.PLATFORMS.length) return;

    for (const p of CONFIG.PLATFORMS) {
      ctx.save();

      // 1. Soft floor shadow beneath platform
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.width / 2, CONFIG.FLOOR_Y + 4, p.width * 0.48, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Heavy Gothic stone / iron support pillars down to arena floor
      const pillarCount = 4;
      const pillarWidth = 24;
      const step = (p.width - 60) / (pillarCount - 1);

      for (let i = 0; i < pillarCount; i++) {
        const px = p.x + 30 + i * step - pillarWidth / 2;
        const pillarTop = p.y + p.height - 2;
        const pillarBottom = CONFIG.FLOOR_Y;
        const pillarHeight = pillarBottom - pillarTop;

        // Pillar main body (carved obsidian / dark slate)
        const pillarGrad = ctx.createLinearGradient(px, 0, px + pillarWidth, 0);
        pillarGrad.addColorStop(0, '#111827');
        pillarGrad.addColorStop(0.3, '#1f2937');
        pillarGrad.addColorStop(0.7, '#374151');
        pillarGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(px, pillarTop, pillarWidth, pillarHeight);

        // Stone column grooves
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 6, pillarTop);
        ctx.lineTo(px + 6, pillarBottom);
        ctx.moveTo(px + pillarWidth - 6, pillarTop);
        ctx.lineTo(px + pillarWidth - 6, pillarBottom);
        ctx.stroke();

        // Iron structural rings
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 2, pillarTop + pillarHeight * 0.45, pillarWidth + 4, 6);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeRect(px - 2, pillarTop + pillarHeight * 0.45, pillarWidth + 4, 6);

        // Stone pillar base at floor
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px - 4, pillarBottom - 8, pillarWidth + 8, 8);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(px - 4, pillarBottom - 8, pillarWidth + 8, 8);

        // Diagonal arch braces
        ctx.strokeStyle = 'rgba(31, 41, 55, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, pillarTop + 14);
        ctx.lineTo(px - 14, pillarTop);
        ctx.moveTo(px + pillarWidth, pillarTop + 14);
        ctx.lineTo(px + pillarWidth + 14, pillarTop);
        ctx.stroke();
      }

      // 3. Platform Dais main body
      const daisGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
      daisGrad.addColorStop(0, '#2d1b2e'); // Deep blood-stone tint
      daisGrad.addColorStop(0.2, '#1e202e');
      daisGrad.addColorStop(0.7, '#111827');
      daisGrad.addColorStop(1, '#090d16');
      ctx.fillStyle = daisGrad;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, [4, 4, 2, 2]);
      ctx.fill();

      // Dais border
      ctx.strokeStyle = '#3f1826';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4. Glowing Runic top landing lip (crisp crimson & gold edge)
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(p.x, p.y, p.width, 3);

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(p.x + 4, p.y + 1, p.width - 8, 1);

      // Carved battle runes / rivets along dais face
      ctx.fillStyle = 'rgba(244, 63, 94, 0.55)';
      for (let rx = p.x + 18; rx < p.x + p.width - 18; rx += 28) {
        ctx.fillRect(rx, p.y + 8, 4, 4);
        ctx.fillRect(rx + 1, p.y + 14, 2, 4);
      }

      // 5. Battle Braziers / Torches at both ends of the dais
      const brazierPositions = [p.x + 16, p.x + p.width - 16];
      const time = Date.now() / 150;

      for (const bx of brazierPositions) {
        // Brazier metal cup
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bx - 6, p.y - 10, 12, 10);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 6, p.y - 10, 12, 10);

        // Flickering fire particles
        const flameH = 12 + Math.sin(time + bx) * 3;
        const flameW = 8 + Math.cos(time * 1.5 + bx) * 2;

        // Fire Outer Aura
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.beginPath();
        ctx.arc(bx, p.y - 12, 14, 0, Math.PI * 2);
        ctx.fill();

        // Fire Outer Body
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(bx - flameW / 2, p.y - 8);
        ctx.quadraticCurveTo(bx - flameW, p.y - 8 - flameH * 0.6, bx, p.y - 8 - flameH);
        ctx.quadraticCurveTo(bx + flameW, p.y - 8 - flameH * 0.6, bx + flameW / 2, p.y - 8);
        ctx.closePath();
        ctx.fill();

        // Fire Inner Hot Core
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(bx, p.y - 11, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function draw() {
    ctx.save();

    // Apply graphics quality resolution scale
    const qSettings = CONFIG.QUALITY[currentQuality] || CONFIG.QUALITY.high;
    const scale = qSettings.resolutionScale;
    ctx.scale(scale, scale);

    // Screen Shake effect (only if enabled by active quality preset)
    if (screenShakeTimer > 0 && qSettings.screenShake) {
      const shakeX = (Math.random() - 0.5) * screenShakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * screenShakeIntensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Render background
    renderArenaBackground();

    // Render battle platforms
    renderPlatforms();

    // Render Boss and Player
    boss.render(ctx);
    player.render(ctx);

    // Render Attack Clash Visual Effects & Sparks
    renderClashEffects();

    // Render Popups
    renderDamagePopups();

    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap delta time
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
