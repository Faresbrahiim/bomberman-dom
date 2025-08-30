import { GameConstants } from "./constant.js";

export class Bomb {
    constructor(x, y, bombId, playerId) {
        this.x = x;
        this.y = y;
        this.bombId = bombId;
        this.playerId = playerId;
        this.exploded = false;
        this.timer = null;
        
        // Animation properties
        this.frameIndex = 0;
        this.frameTick = 0;
        this.element = null;
        this.animationInterval = null;
        
        // Animation constants
        this.FRAMES_PER_ANIMATION = 3;
        this.ANIMATION_SPEED = 20; // Frames between sprite changes (adjust for speed)
    }

    setElement(element) {
        this.element = element;
        this.startAnimation();
    }

    startAnimation() {
        if (!this.element) return;
        
        // Set initial sprite
        this.updateSprite();
        
        // Start animation loop
        this.animationInterval = setInterval(() => {
            if (this.exploded) {
                this.stopAnimation();
                return;
            }
            
            this.frameTick++;
            if (this.frameTick >= this.ANIMATION_SPEED) {
                this.frameIndex = (this.frameIndex + 1) % this.FRAMES_PER_ANIMATION;
                this.frameTick = 0;
                this.updateSprite();
            }
        }, 1000 / 60); // 60 FPS
    }

    updateSprite() {
        if (this.element) {
            // Set the bomb sprite image
            this.element.style.backgroundImage = "url('media/bomb.png')";
            this.element.style.backgroundSize = `${GameConstants.TILE_SIZE * this.FRAMES_PER_ANIMATION}px ${GameConstants.TILE_SIZE}px`;
            this.element.style.backgroundPosition = `-${this.frameIndex * GameConstants.TILE_SIZE}px 0px`;
            this.element.style.backgroundRepeat = "no-repeat";
        }
    }

    stopAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    startTimer(callback) {
        this.timer = setTimeout(() => {
            callback(this.x, this.y);
        }, GameConstants.BOMB_TIMER);
    }

    explode() {
        this.exploded = true;
        this.stopAnimation();
        if (this.timer) {
            clearTimeout(this.timer);
        }
    }
}