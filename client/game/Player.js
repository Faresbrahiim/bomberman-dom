// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { GameConstants } from "./constant.js";

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - PLAYER ENTITY BLUEPRINT)
// =============================================================================
export class Player {
  // =============================================================================
  // STEP 3: CONSTRUCTOR (EXECUTED THIRD - PLAYER INSTANCE INITIALIZATION)
  // =============================================================================
  constructor(x, y, playerId) {
    // Store initial position and identification data
    this.position = { x, y };
    this.playerId = playerId;
    this.nickname = "";
    this.lives = 3;
    this.powerups = { bombs: 0, flames: 0, speed: 0 };
    this.isInvincible = false;
    this.isLocal = false;
    
    // Animation and movement state tracking
    this.direction = "down";
    this.frameIndex = 0;
    this.frameTick = 0;
    this.element = null;
    this.isMoving = false;
    this.lastPosition = { x, y };
    this.movementTimeout = null;
    this.lastMovementTime = 0;

    // Initialize avatar appearance based on player ID
    this.avatarColor = this.getAvatarColor(playerId);
    this.sprites = this.getAvatarSprites(this.avatarColor);
  }

  // =============================================================================
  // STEP 4: AVATAR COLOR ASSIGNMENT (EXECUTED DURING CONSTRUCTION - VISUAL IDENTITY)
  // =============================================================================
  getAvatarColor(playerId) {
    // Map player IDs to distinct colors for visual differentiation
    const avatarColors = ['green', 'red', 'yellow', 'blue'];
    return avatarColors[(playerId - 1) % 4];
  }

  // =============================================================================
  // STEP 5: SPRITE PATH GENERATION (EXECUTED DURING CONSTRUCTION - ANIMATION ASSETS)
  // =============================================================================
  getAvatarSprites(color) {
    // Generate sprite paths for all movement directions
    return {
      down: `media/avatar${this.getAvatarNumber(color)}/move_down_${color}.png`,
      up: `media/avatar${this.getAvatarNumber(color)}/move_up_${color}.png`,
      left: `media/avatar${this.getAvatarNumber(color)}/move_left_${color}.png`,
      right: `media/avatar${this.getAvatarNumber(color)}/move_right_${color}.png`,
    };
  }

  // =============================================================================
  // STEP 6: AVATAR NUMBER MAPPING (EXECUTED DURING SPRITE GENERATION - PATH RESOLUTION)
  // =============================================================================
  getAvatarNumber(color) {
    // Map color names to avatar directory numbers
    const colorToNumber = {
      'green': '1',
      'red': '2', 
      'yellow': '3',
      'blue': '4'
    };
    return colorToNumber[color] || '1';
  }

  // =============================================================================
  // STEP 7: SPRITE RENDERING (EXECUTED ON ANIMATION UPDATES - VISUAL DISPLAY)
  // =============================================================================
  updateSprite() {
    if (this.element) {
      // Apply current direction sprite with frame-based animation
      this.element.style.backgroundImage = `url('${
        this.sprites[this.direction]
      }')`;
      this.element.style.backgroundSize = "auto 60px";
      this.element.style.backgroundPosition = `-${
        this.frameIndex * GameConstants.TILE_SIZE
      }px 0px`;
    }
  }

  // =============================================================================
  // STEP 8: DOM ELEMENT BINDING (EXECUTED ON RENDERING - VISUAL CONNECTION)
  // =============================================================================
  setElement(element) {
    // Link DOM element to player instance
    this.element = element;
    // Add avatar-specific class for additional styling if needed
    this.element.classList.add(`avatar-${this.avatarColor}`);
    this.updateElementPosition();
  }

  // =============================================================================
  // STEP 9: POSITION SYNCHRONIZATION (EXECUTED ON MOVEMENT - DOM UPDATE)
  // =============================================================================
  updateElementPosition() {
    if (this.element) {
      // Update DOM element position to match logical position
      this.element.style.left = this.position.x + "px";
      this.element.style.top = this.position.y + "px";
    }
  }

  // =============================================================================
  // STEP 10: GRID POSITION CALCULATION (EXECUTED ON DEMAND - COLLISION DETECTION)
  // =============================================================================
  getGridPosition() {
    // Convert pixel position to grid coordinates for map interaction
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

  // =============================================================================
  // STEP 11: SPEED CALCULATION (EXECUTED ON MOVEMENT - PHYSICS COMPUTATION)
  // =============================================================================
  getCurrentSpeed() {
    // Calculate current movement speed based on base speed and powerups
    return GameConstants.BASE_PLAYER_SPEED + this.powerups.speed * 0.5;
  }

  // =============================================================================
  // STEP 12: POWERUP COLLECTION (EXECUTED ON PICKUP - ABILITY ENHANCEMENT)
  // =============================================================================
  collectPowerup(powerupType) {
    // Increment appropriate powerup based on type collected
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

    // Provide visual feedback for powerup collection
    if (this.element) {
      this.element.classList.add("powerup-collected");
      setTimeout(() => {
        if (this.element) {
          this.element.classList.remove("powerup-collected");
        }
      }, 600);
    }
  }

  // =============================================================================
  // STEP 13: MOVEMENT STATE MANAGEMENT (EXECUTED ON MOVEMENT CHANGES - ANIMATION CONTROL)
  // =============================================================================
  setMoving(isMoving) {
    this.isMoving = isMoving;

    // Clear existing timeout to prevent animation conflicts
    if (this.movementTimeout) {
      clearTimeout(this.movementTimeout);
      this.movementTimeout = null;
    }

    // If player is moving, set a timeout to stop animation after movement ends
    if (isMoving) {
      this.lastMovementTime = Date.now(); // Record when movement started
      this.movementTimeout = setTimeout(() => {
        this.isMoving = false;
        this.frameIndex = 0;
        this.updateSprite();
      }, 150); // Reduced timeout to 150ms
    }
  }

  // =============================================================================
  // STEP 14: DAMAGE PROCESSING (EXECUTED ON EXPLOSION HIT - HEALTH MANAGEMENT)
  // =============================================================================
  takeDamage() {
    // Ignore damage if already invincible or dead
    if (this.isInvincible || this.lives <= 0) return false;

    // Apply visual damage feedback
    if (this.element) {
      this.element.classList.add("damage-flash");
    }

    // Set invincibility state to prevent multiple hits
    this.isInvincible = true;
    console.log(this.lives);
    
    // Handle invincibility duration based on remaining lives
    if (this.lives > 0) {
      console.log(GameConstants.INVINCIBILITY_DURATION);
      
      // Temporary invincibility for living players
      setTimeout(() => {
        this.isInvincible = false;
        if (this.element) {
          this.element.classList.remove("damage-flash");
        }
      }, GameConstants.INVINCIBILITY_DURATION);
    } else {
      // Player is dead, apply permanent visual effect
      this.applyDeadPlayerEffect();
    }

    return true; // Damage was taken
  }

  // =============================================================================
  // STEP 15: DEATH VISUAL EFFECTS (EXECUTED ON PLAYER DEATH - APPEARANCE CHANGE)
  // =============================================================================
  applyDeadPlayerEffect() {
    if (this.element) {
      // Apply dark filter to make the player almost black
      this.element.style.filter = "brightness(0.1) contrast(0.5)";
      this.element.style.opacity = "0.6";
      this.element.classList.add("dead-player");
    }
  }

  removeDeadPlayerEffect() {
    if (this.element) {
      // Remove the dark filter effect for revival
      this.element.style.filter = "";
      this.element.style.opacity = "";
      this.element.classList.remove("dead-player");
    }
  }

  // =============================================================================
  // STEP 16: ANIMATION UPDATE (EXECUTED ON GAME LOOP - MOVEMENT ANIMATION)
  // =============================================================================
  updateAnimation(dx, dy) {
    const isCurrentlyMoving = (dx !== 0 || dy !== 0);
    
    if (!isCurrentlyMoving) {
        // Stop animation and reset to idle frame
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
        
        // Determine movement direction based on velocity
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
        } else {
            this.direction = dy > 0 ? 'down' : 'up';
        }

        // Only local players advance frames here (others sync via network)
        if (this.isLocal) {
            this.frameTick++;
            if (this.frameTick >= GameConstants.FRAME_SPEED) {
                this.frameIndex = (this.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
                this.frameTick = 0;
            }
        }
    }

    // Update sprite display with current animation state
    this.updateSprite();
  }
}