// Game Configuration and Constants
const CONFIG = {
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,
  FLOOR_Y: 460,
  GRAVITY: 1400,

  // Battle Arena Elevated Platforms
  PLATFORMS: [
    {
      id: 'boss_platform',
      x: 440,
      y: 345,
      width: 480,
      height: 24,
      name: 'Overlord Battle Dais'
    }
  ],

  // Graphics Quality Presets (low, medium, high, ultra)
  QUALITY: {
    low: {
      id: 'low',
      label: 'Low (High Performance)',
      resolutionScale: 0.65,
      pixelated: true,
      screenShake: false,
      glowEffects: false,
      shadows: false
    },
    medium: {
      id: 'medium',
      label: 'Medium (Balanced)',
      resolutionScale: 0.85,
      pixelated: false,
      screenShake: true,
      glowEffects: false,
      shadows: true
    },
    high: {
      id: 'high',
      label: 'High (Standard HD)',
      resolutionScale: 1.0,
      pixelated: false,
      screenShake: true,
      glowEffects: true,
      shadows: true
    },
    ultra: {
      id: 'ultra',
      label: 'Ultra (Maximum Quality)',
      resolutionScale: 1.25,
      pixelated: false,
      screenShake: true,
      glowEffects: true,
      shadows: true
    }
  },

  // Asset paths (Transparent PNGs facing right, background image, cinematic hero)
  ASSETS: {
    PLAYER: 'assets/characters/player.png',
    BOSS: 'assets/characters/boss.png',
    BACKGROUND: 'assets/background.png',
    CINEMATIC: 'assets/cinematic.jpg'
  },

  // Player configuration (Matched to Villain: 260x310 Colossal Scale)
  PLAYER: {
    MAX_HP: 100,
    MAX_STAMINA: 100,
    STAMINA_RECOVERY_RATE: 22, // stamina per second
    
    // Display sprite dimensions (Same as Boss: 260x310 Colossal Scale)
    WIDTH: 260,
    HEIGHT: 310,

    // Relative hitbox from sprite origin (top-left)
    HITBOX: {
      offsetX: 40,
      offsetY: 30,
      width: 180,
      height: 270
    },

    SPEED: 280,
    JUMP_FORCE: 600,

    ATTACK_DAMAGE: 16,
    ATTACK_RANGE: 160,
    ATTACK_DURATION: 0.28,
    ATTACK_COOLDOWN: 0.35,
    ATTACK_STAMINA_COST: 15,

    BLOCK_DAMAGE_REDUCTION: 0.8, // 80% reduction
    BLOCK_STAMINA_DRAIN_ON_HIT: 12,

    DASH_SPEED: 700,
    DASH_DURATION: 0.24,
    DASH_COOLDOWN: 1.2,
    DASH_STAMINA_COST: 25,

    PLACEHOLDER_COLOR: '#38bdf8' // Cyan-blue samurai placeholder
  },

  // Boss configuration (Colossal Titan Pixel Size)
  BOSS: {
    MAX_HP: 300,
    PHASE2_HP_THRESHOLD: 150, // 50% HP

    // Display sprite dimensions (Towering Giant Boss Pixel Size)
    WIDTH: 260,
    HEIGHT: 310,

    // Relative hitbox
    HITBOX: {
      offsetX: 40,
      offsetY: 30,
      width: 180,
      height: 270
    },

    SPEED_PHASE1: 140,
    SPEED_PHASE2: 210,

    DECISION_INTERVAL_MS: 2000, // ~2 seconds idle decision trigger

    PLACEHOLDER_COLOR: '#ef4444', // Crimson boss placeholder
    PLACEHOLDER_COLOR_PHASE2: '#f43f5e'
  },

  // Boss Moves and Parameters
  MOVES: {
    ALLOWED: ['melee_slash', 'fireball', 'charge', 'ground_slam', 'retreat'],
    
    melee_slash: {
      name: 'melee_slash',
      windup: 0.35,
      active: 0.22,
      recovery: 0.35,
      damage: 26,
      range: 160
    },

    fireball: {
      name: 'fireball',
      windup: 0.45,
      active: 0.1,
      recovery: 0.4,
      damage: 22,
      projectileSpeed: 460,
      radius: 22
    },

    charge: {
      name: 'charge',
      windup: 0.45,
      duration: 0.5,
      recovery: 0.35,
      speed: 620,
      damage: 32
    },

    ground_slam: {
      name: 'ground_slam',
      leapTime: 0.35,
      slamDamage: 30,
      shockwaveSpeed: 380,
      shockwaveDamage: 20,
      shockwaveLifetime: 0.7
    },

    retreat: {
      name: 'retreat',
      duration: 0.4,
      speed: 400
    }
  },

  // Attack Clash Dynamics (Health Bar Differences on Attack-vs-Attack Impact)
  CLASH: {
    BLADE_CLASH: {
      bossDamage: 24,       // Difference: Boss takes 24 HP
      playerDamage: 8,      // Difference: Player takes 8 HP
      recoilBoss: 210,
      recoilPlayer: 190,
      shakeDuration: 0.28,
      shakeIntensity: 9
    },
    CHARGE_CLASH: {
      bossDamage: 28,       // Boss countered hard for charging directly into katana
      playerDamage: 14,     // Player absorbs kinetic charging momentum
      recoilBoss: 250,
      recoilPlayer: 220,
      shakeDuration: 0.35,
      shakeIntensity: 12
    },
    FIREBALL_CLASH: {
      bossDamage: 16,       // Reflected blade-sliced explosion hits Boss
      playerDamage: 4,      // Slight heat singe
      recoilBoss: 90,
      recoilPlayer: 70,
      shakeDuration: 0.2,
      shakeIntensity: 6
    }
  }
};

window.CONFIG = CONFIG;
