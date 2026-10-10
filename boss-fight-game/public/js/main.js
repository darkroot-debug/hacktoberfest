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

  let gameState = 'start'; // 'start', 'playing', 'gameover', 'victory'
  let lastTime = performance.now();
  let screenShakeTimer = 0;
  let screenShakeIntensity = 0;

  // Damage popup numbers
  let damagePopups = [];

  function addDamagePopup(x, y, text, color = '#ffffff') {
    damagePopups.push({
      x,
      y,
      text,
      color,
      timer: 0.7,
      vy: -50
    });
  }

  function triggerScreenShake(duration, intensity) {
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

  function startGame() {
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

  ui.init(startGame, restartGame);
  ui.showStartScreen();

  function update(dt) {
    if (gameState !== 'playing') return;

    // Update screen shake
    if (screenShakeTimer > 0) {
      screenShakeTimer -= dt;
    }

    // Update player and boss
    player.update(dt, input, boss.x);
    boss.update(dt, player.x, player.y);

    // AI decision update
    ai.update(dt, boss, player);

    // Check Player attack hitting Boss
    const attackBox = player.getAttackHitbox();
    if (attackBox && !player.hasHitThisAttack) {
      const bossHitbox = boss.getHitbox();
      if (checkAABB(attackBox, bossHitbox)) {
        player.hasHitThisAttack = true;
        const dealt = boss.takeDamage(CONFIG.PLAYER.ATTACK_DAMAGE);
        addDamagePopup(boss.x + boss.width / 2, boss.y + 10, `-${dealt}`, '#38bdf8');
        triggerScreenShake(0.12, 4);

        if (boss.isDead) {
          gameState = 'victory';
          ui.showVictory();
        }
      }
    }

    // Check Boss Melee Slash hitting Player
    const meleeBox = boss.getMeleeHitbox();
    if (meleeBox && !boss.meleeHitDealt) {
      const playerHitbox = player.getHitbox();
      if (checkAABB(meleeBox, playerHitbox)) {
        boss.meleeHitDealt = true;
        const result = player.takeDamage(meleeBox.damage, boss.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#ef4444');
          triggerScreenShake(0.2, result.blocked ? 3 : 7);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8');
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Charge hitting Player
    const chargeBox = boss.getChargeHitbox();
    if (chargeBox && !boss.chargeDamageDealt) {
      const playerHitbox = player.getHitbox();
      if (checkAABB(chargeBox, playerHitbox)) {
        boss.chargeDamageDealt = true;
        const result = player.takeDamage(chargeBox.damage, boss.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#ef4444');
          triggerScreenShake(0.25, result.blocked ? 4 : 9);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8');
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Fireballs hitting Player
    const playerHitbox = player.getHitbox();
    for (const fb of boss.fireballs) {
      if (fb.active && checkCircleBox(fb, playerHitbox)) {
        fb.active = false;
        const result = player.takeDamage(fb.damage, fb.x);
        if (result.hit) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, result.blocked ? '#fbbf24' : '#f97316');
          triggerScreenShake(0.18, 5);
        } else if (result.dodged) {
          addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8');
        }

        if (player.isDead) {
          gameState = 'gameover';
          ui.showGameOver();
        }
      }
    }

    // Check Boss Shockwaves hitting Player
    for (const sw of boss.shockwaves) {
      if (sw.active) {
        const swBox = { x: sw.x - 20, y: sw.y - 25, width: 40, height: 25 };
        if (checkAABB(swBox, playerHitbox)) {
          sw.active = false;
          const result = player.takeDamage(sw.damage, sw.x);
          if (result.hit) {
            addDamagePopup(player.x + player.width / 2, player.y + 10, result.blocked ? `Blocked -${result.damage}` : `-${result.damage}`, '#ef4444');
            triggerScreenShake(0.2, 6);
          } else if (result.dodged) {
            addDamagePopup(player.x + player.width / 2, player.y + 10, 'Dodged!', '#38bdf8');
          }

          if (player.isDead) {
            gameState = 'gameover';
            ui.showGameOver();
          }
        }
      }
    }

    // Update popups
    for (const pop of damagePopups) {
      pop.timer -= dt;
      pop.y += pop.vy * dt;
    }
    damagePopups = damagePopups.filter(pop => pop.timer > 0);

    // Update UI HUD
    ui.updateHUD(player, boss);
    ui.updateTauntBubblePosition(boss, canvas);

    input.resetFrameTriggers();
  }

  function renderArenaBackground() {
    // Ambient dark arena sky gradient
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

  function renderDamagePopups() {
    for (const pop of damagePopups) {
      ctx.save();
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.fillStyle = pop.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();

    // Screen Shake effect
    if (screenShakeTimer > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * screenShakeIntensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Render background
    renderArenaBackground();

    // Render Boss and Player
    boss.render(ctx);
    player.render(ctx);

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
