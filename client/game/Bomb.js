// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { GameConstants } from "./constant.js";

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - BOMB ENTITY BLUEPRINT)
// =============================================================================
export class Bomb {
    // =============================================================================
    // STEP 3: CONSTRUCTOR (EXECUTED THIRD - BOMB INSTANCE INITIALIZATION)
    // =============================================================================
    constructor(x, y, bombId, playerId) {
        // Store bomb position and identification data
        this.x = x;
        this.y = y;
        this.bombId = bombId;
        this.playerId = playerId;
        this.exploded = false;
        this.timer = null;
        
        // Animation properties for visual bomb ticking effect
        this.frameIndex = 0;
        this.frameTick = 0;
        this.element = null;
        this.animationInterval = null;
        
        // Animation constants for sprite cycling behavior
        this.FRAMES_PER_ANIMATION = 3;
        this.ANIMATION_SPEED = 20; // Frames between sprite changes (adjust for speed)
    }

    // =============================================================================
    // STEP 4: ELEMENT BINDING (EXECUTED ON DOM CREATION - VISUAL SETUP)
    // =============================================================================
    setElement(element) {
        // Link DOM element to bomb instance and start visual animation
        this.element = element;
        this.startAnimation();
    }

    // =============================================================================
    // STEP 5: ANIMATION SYSTEM (EXECUTED AFTER ELEMENT BINDING - VISUAL EFFECTS)
    // =============================================================================
    startAnimation() {
        // Validate element exists before starting animation
        if (!this.element) return;
        
        // Set initial sprite frame
        this.updateSprite();
        
        // Start continuous animation loop at 60 FPS
        this.animationInterval = setInterval(() => {
            // Stop animation if bomb has exploded
            if (this.exploded) {
                this.stopAnimation();
                return;
            }
            
            // Update frame timing and cycle through sprite frames
            this.frameTick++;
            if (this.frameTick >= this.ANIMATION_SPEED) {
                this.frameIndex = (this.frameIndex + 1) % this.FRAMES_PER_ANIMATION;
                this.frameTick = 0;
                this.updateSprite();
            }
        }, 1000 / 60); // 60 FPS
    }

    // =============================================================================
    // STEP 6: SPRITE RENDERING (EXECUTED ON ANIMATION FRAMES - VISUAL UPDATE)
    // =============================================================================
    updateSprite() {
        if (this.element) {
            // Apply bomb sprite with frame-based animation positioning
            this.element.style.backgroundImage = "url('media/bomb.png')";
            this.element.style.backgroundSize = `${GameConstants.TILE_SIZE * this.FRAMES_PER_ANIMATION}px ${GameConstants.TILE_SIZE}px`;
            this.element.style.backgroundPosition = `-${this.frameIndex * GameConstants.TILE_SIZE}px 0px`;
            this.element.style.backgroundRepeat = "no-repeat";
        }
    }

    // =============================================================================
    // STEP 7: ANIMATION CLEANUP (EXECUTED ON EXPLOSION - RESOURCE MANAGEMENT)
    // =============================================================================
    stopAnimation() {
        // Clear animation interval to prevent memory leaks
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    // =============================================================================
    // STEP 8: EXPLOSION TIMER (EXECUTED ON PLACEMENT - COUNTDOWN MECHANISM)
    // =============================================================================
    startTimer(callback) {
        // Set explosion timer using game constant duration
        this.timer = setTimeout(() => {
            callback(this.x, this.y);
        }, GameConstants.BOMB_TIMER);
    }

    // =============================================================================
    // STEP 9: EXPLOSION EXECUTION (EXECUTED ON TIMER/TRIGGER - STATE CHANGE)
    // =============================================================================
    explode() {
        // Mark bomb as exploded and cleanup all timers/animations
        this.exploded = true;
        this.stopAnimation();
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }
}