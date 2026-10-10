// Game Configuration and Constants
const CONFIG = {
  CANVAS_WIDTH: 960,
  CANVAS_HEIGHT: 540,
  FLOOR_Y: 460,
  GRAVITY: 1400,

  // Asset paths (Transparent PNGs facing right)
  ASSETS: {
    PLAYER: 'assets/characters/player.png',
    BOSS: 'assets/characters/boss.png'
  },

  // Player configuration
  PLAYER: {
    MAX_HP: 100,
    MAX_STAMINA: 100,
    STAMINA_RECOVERY_RATE: 22, // stamina per second
    
    // Display sprite dimensions
    WIDTH: 64,
    HEIGHT: 84,

    // Relative hitbox from sprite origin (top-left)
    HITBOX: {
      offsetX: 12,
      offsetY: 8,
      width: 40,
      height: 76
    },

    SPEED: 280,
    JUMP_FORCE: 560,

    ATTACK_DAMAGE: 16,
    ATTACK_RANGE: 65,
    ATTACK_DURATION: 0.28,
    ATTACK_COOLDOWN: 0.35,
    ATTACK_STAMINA_COST: 15,

    BLOCK_DAMAGE_REDUCTION: 0.8, // 80% reduction
    BLOCK_STAMINA_DRAIN_ON_HIT: 12,

    DASH_SPEED: 650,
    DASH_DURATION: 0.22,
    DASH_COOLDOWN: 1.2,
    DASH_STAMINA_COST: 25,

    PLACEHOLDER_COLOR: '#38bdf8' // Cyan-blue knight placeholder
  },

  // Boss configuration
  BOSS: {
    MAX_HP: 300,
    PHASE2_HP_THRESHOLD: 150, // 50% HP

    // Display sprite dimensions
    WIDTH: 96,
    HEIGHT: 124,

    // Relative hitbox
    HITBOX: {
      offsetX: 16,
      offsetY: 12,
      width: 64,
      height: 112
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
      range: 95
    },

    fireball: {
      name: 'fireball',
      windup: 0.45,
      active: 0.1,
      recovery: 0.4,
      damage: 22,
      projectileSpeed: 440,
      radius: 16
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
  }
};

window.CONFIG = CONFIG;
