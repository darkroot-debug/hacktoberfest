// Keyboard input management
class InputManager {
  constructor() {
    this.keys = {
      left: false,
      right: false,
      jump: false,
      attack: false,
      block: false,
      dash: false
    };

    this.justPressed = {
      jump: false,
      attack: false,
      dash: false
    };

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      // Prevent page scrolling on gaming keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      this._handleKeyEvent(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this._handleKeyEvent(e.code, false);
    });

    // Reset keys if browser window loses focus
    window.addEventListener('blur', () => {
      for (const key in this.keys) {
        this.keys[key] = false;
      }
      for (const key in this.justPressed) {
        this.justPressed[key] = false;
      }
    });
  }

  _handleKeyEvent(code, isDown) {
    switch (code) {
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        break;

      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
        break;

      case 'KeyW':
      case 'Space':
      case 'ArrowUp':
        if (isDown && !this.keys.jump) {
          this.justPressed.jump = true;
        }
        this.keys.jump = isDown;
        break;

      case 'KeyJ':
        if (isDown && !this.keys.attack) {
          this.justPressed.attack = true;
        }
        this.keys.attack = isDown;
        break;

      case 'KeyK':
        this.keys.block = isDown;
        break;

      case 'KeyL':
        if (isDown && !this.keys.dash) {
          this.justPressed.dash = true;
        }
        this.keys.dash = isDown;
        break;
    }
  }

  // Poll and consume a justPressed event
  consumeJustPressed(action) {
    if (this.justPressed[action]) {
      this.justPressed[action] = false;
      return true;
    }
    return false;
  }

  // Clear single-frame triggers at end of update tick
  resetFrameTriggers() {
    this.justPressed.jump = false;
    this.justPressed.attack = false;
    this.justPressed.dash = false;
  }
}

window.InputManager = InputManager;
