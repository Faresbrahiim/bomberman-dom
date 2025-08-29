import { GameConstants } from "./constant.js";

export class Player {
  constructor(x, y, playerId) {
    this.position = { x, y };
    this.playerId = playerId;
    this.nickname = "";
    this.lives = 3;
    this.powerups = { bombs: 0, flames: 0, speed: 0 };
    this.isInvincible = false;
    this.isLocal = false;
    this.direction = "down";
    this.frameIndex = 0;
    this.frameTick = 0;
    this.element = null;
    this.isMoving = false;
    this.lastPosition = { x, y };
    this.movementTimeout = null;
    this.lastMovementTime = 0;

    // Avatar assignment based on player ID
    this.avatarColor = this.getAvatarColor(playerId);
    this.sprites = this.getAvatarSprites(this.avatarColor);
  }

  getAvatarColor(playerId) {
    const avatarColors = ['green', 'red', 'yellow', 'blue'];
    return avatarColors[(playerId - 1) % 4];
  }

  getAvatarSprites(color) {
    return {
      down: `media/avatar${this.getAvatarNumber(color)}/move_down_${color}.png`,
      up: `media/avatar${this.getAvatarNumber(color)}/move_up_${color}.png`,
      left: `media/avatar${this.getAvatarNumber(color)}/move_left_${color}.png`,
      right: `media/avatar${this.getAvatarNumber(color)}/move_right_${color}.png`,
    };
  }

  getAvatarNumber(color) {
    const colorToNumber = {
      'green': '1',
      'red': '2', 
      'yellow': '3',
      'blue': '4'
    };
    return colorToNumber[color] || '1';
  }

  updateSprite() {
    if (this.element) {
      this.element.style.backgroundImage = `url('${
        this.sprites[this.direction]
      }')`;
      this.element.style.backgroundSize = "auto 60px";
      this.element.style.backgroundPosition = `-${
        this.frameIndex * GameConstants.TILE_SIZE
      }px 0px`;
    }
  }

  setElement(element) {
    this.element = element;
    // Add avatar-specific class for additional styling if needed
    this.element.classList.add(`avatar-${this.avatarColor}`);
    this.updateElementPosition();
  }

  updateElementPosition() {
    if (this.element) {
      this.element.style.left = this.position.x + "px";
      this.element.style.top = this.position.y + "px";
    }
  }

  getGridPosition() {
    return {
      x: Math.floor(
        (this.position.x + GameConstants.TILE_SIZE / 2) /
          GameConstants.TILE_SIZE
      ),
      y: Math.floor(
        (this.position.y + GameConstants.TILE_SIZE / 2) /
          GameConstants.TILE_SIZE
      ),
    };
  }

  getCurrentSpeed() {
    return GameConstants.BASE_PLAYER_SPEED + this.powerups.speed * 0.5;
  }

  collectPowerup(powerupType) {
    switch (powerupType) {
      case GameConstants.CELL_TYPES.BOMB_POWERUP:
        this.powerups.bombs++;
        break;
      case GameConstants.CELL_TYPES.FLAME_POWERUP:
        this.powerups.flames++;
        break;
      case GameConstants.CELL_TYPES.SPEED_POWERUP:
        this.powerups.speed++;
        break;
    }

    // Visual feedback for powerup collection
    if (this.element) {
      this.element.classList.add("powerup-collected");
      setTimeout(() => {
        if (this.element) {
          this.element.classList.remove("powerup-collected");
        }
      }, 600);
    }
  }

  setMoving(isMoving) {
    this.isMoving = isMoving;

    // Clear existing timeout
    if (this.movementTimeout) {
      clearTimeout(this.movementTimeout);
      this.movementTimeout = null;
    }

    // If player is moving, set a timeout to stop animation
    if (isMoving) {
      this.lastMovementTime = Date.now(); // Record when movement started
      this.movementTimeout = setTimeout(() => {
        this.isMoving = false;
        this.frameIndex = 0;
        this.updateSprite();
      }, 150); // Reduced timeout to 150ms
    }
  }

  takeDamage() {
    if (this.isInvincible || this.lives <= 0) return false;

    this.lives--;

    if (this.element) {
      this.element.classList.add("damage-flash");
    }

    this.isInvincible = true;

    if (this.lives > 0) {
      setTimeout(() => {
        this.isInvincible = false;
        if (this.element) {
          this.element.classList.remove("damage-flash");
        }
      }, GameConstants.INVINCIBILITY_DURATION);
    } else {
      // Player is dead, apply dark filter effect
      this.applyDeadPlayerEffect();
    }

    return true; // Damage was taken
  }

  applyDeadPlayerEffect() {
    if (this.element) {
      // Apply a dark filter to make the player almost black
      this.element.style.filter = "brightness(0.1) contrast(0.5)";
      this.element.style.opacity = "0.6";
      this.element.classList.add("dead-player");
    }
  }

  removeDeadPlayerEffect() {
    if (this.element) {
      // Remove the dark filter effect
      this.element.style.filter = "";
      this.element.style.opacity = "";
      this.element.classList.remove("dead-player");
    }
  }

  updateAnimation(dx, dy) {
    const isCurrentlyMoving = (dx !== 0 || dy !== 0);
    
    if (!isCurrentlyMoving) {
        this.isMoving = false;
        this.frameIndex = 0;
        // Clear any existing timeout
        if (this.movementTimeout) {
          clearTimeout(this.movementTimeout);
          this.movementTimeout = null;
        }
    } else {
        // Set moving state with timeout (for remote players)
        if (!this.isLocal) {
          this.setMoving(true);
        } else {
          this.isMoving = true;
        }
        
        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
        } else {
            this.direction = dy > 0 ? 'down' : 'up';
        }

        // Only local players advance frames here
        if (this.isLocal) {
            this.frameTick++;
            if (this.frameTick >= GameConstants.FRAME_SPEED) {
                this.frameIndex = (this.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
                this.frameTick = 0;
            }
        }
    }

    this.updateSprite();
  }
}