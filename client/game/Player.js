import { GameConstants } from "./constant.js";

export class Player {
    constructor(x, y) {
        this.position = { x, y };
        this.powerups = { bombs: 0, flames: 0, speed: 0, health: 3 };
        this.isInvincible = false;
        this.direction = 'down';
        this.frameIndex = 0;
        this.frameTick = 0;
        this.element = null;
        
        this.sprites = {
            down: 'media/move_down.png',
            up: 'media/move_up.png',
            left: 'media/move_left.png',
            right: 'media/move_right.png'
        };
    }

    setElement(element) {
        this.element = element;
        this.updateElementPosition();
    }

    updateElementPosition() {
        if (this.element) {
            this.element.style.left = this.position.x + 'px';
            this.element.style.top = this.position.y + 'px';
        }
    }

    getGridPosition() {
        return {
            x: Math.floor((this.position.x + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE),
            y: Math.floor((this.position.y + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE)
        };
    }

    getCurrentSpeed() {
        return GameConstants.BASE_PLAYER_SPEED + (this.powerups.speed * 0.5);
    }

    collectPowerup(powerupType) {
        let statusElement;
        switch (powerupType) {
            case GameConstants.CELL_TYPES.BOMB_POWERUP:
                this.powerups.bombs++;
                statusElement = document.querySelector('.bomb-status');
                break;
            case GameConstants.CELL_TYPES.FLAME_POWERUP:
                this.powerups.flames++;
                statusElement = document.querySelector('.flame-status');
                break;
            case GameConstants.CELL_TYPES.SPEED_POWERUP:
                this.powerups.speed++;
                statusElement = document.querySelector('.speed-status');
                break;
        }

        if (statusElement) {
            statusElement.classList.add('powerup-collected');
            setTimeout(() => statusElement.classList.remove('powerup-collected'), 600);
        }
    }

    takeDamage() {
        if (this.isInvincible) return;

        this.powerups.health--;
        this.element.classList.add('damage-flash');
        this.isInvincible = true;

        if (this.powerups.health <= 0) {
            return; // Game over
        } else {
            setTimeout(() => {
                this.isInvincible = false;
                this.element.classList.remove('damage-flash');
            }, GameConstants.INVINCIBILITY_DURATION);
        }
    }

    updateAnimation(dx, dy) {
        if (dx === 0 && dy === 0) {
            this.frameIndex = 0;
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.direction = dy > 0 ? 'down' : 'up';
            }

            this.frameTick++;
            if (this.frameTick >= GameConstants.FRAME_SPEED) {
                this.frameIndex = (this.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
                this.frameTick = 0;
            }
        }

        if (this.element) {
            this.element.style.backgroundImage = `url('${this.sprites[this.direction]}')`;
            this.element.style.backgroundPosition = `-${this.frameIndex * GameConstants.TILE_SIZE}px 0px`;
        }
    }
}