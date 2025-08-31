import { GameConstants } from "./constant.js";
import { VNode } from "../framework/vdom.js";

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
    this.isMoving = false;
    this.hasDamageFlash = false;
    this.dead = false;

    // Avatar assignment
    this.avatarColor = this.getAvatarColor(playerId);
    this.sprites = this.getAvatarSprites(this.avatarColor);
  }

  getAvatarColor(playerId) {
    const avatarColors = ["green", "red", "yellow", "blue"];
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
    const colorToNumber = { green: "1", red: "2", yellow: "3", blue: "4" };
    return colorToNumber[color] || "1";
  }

  getGridPosition() {
    return {
      x: Math.floor((this.position.x + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE),
      y: Math.floor((this.position.y + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE),
    };
  }

  getCurrentSpeed() {
    return GameConstants.BASE_PLAYER_SPEED + this.powerups.speed * 0.5;
  }

  collectPowerup(powerupType) {
    switch (powerupType) {
      case GameConstants.CELL_TYPES.BOMB_POWERUP: this.powerups.bombs++; break;
      case GameConstants.CELL_TYPES.FLAME_POWERUP: this.powerups.flames++; break;
      case GameConstants.CELL_TYPES.SPEED_POWERUP: this.powerups.speed++; break;
    }
  }

  takeDamage() {
    if (this.isInvincible || this.lives <= 0) return false;
    this.lives--;
    this.isInvincible = true;
    this.hasDamageFlash = true;

    if (this.lives > 0) {
      setTimeout(() => {
        this.isInvincible = false;
        this.hasDamageFlash = false;
      }, GameConstants.INVINCIBILITY_DURATION);
    } else {
      this.dead = true;
    }
    return true;
  }

  updateAnimation(dx, dy) {
    const isMoving = dx !== 0 || dy !== 0;
    this.isMoving = isMoving;

    if (isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? "right" : "left";
      } else {
        this.direction = dy > 0 ? "down" : "up";
      }

      if (this.isLocal) {
        this.frameTick++;
        if (this.frameTick >= GameConstants.FRAME_SPEED) {
          this.frameIndex = (this.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
          this.frameTick = 0;
        }
      }
    } else {
      this.frameIndex = 0;
    }
  }

  // -------------------------
  // VNode rendering
  // -------------------------
  render() {
    const classes = ["player", `avatar-${this.avatarColor}`];
    if (data.his.isLocal) classes.push("local-player");
    if (data.dead) classes.push("dead-player");
    if (data.hasDamageFlash) classes.push("damage-flash");

    return new VNode("div", {
      id: `player-${data.playerId}`,
      class: classes.join(" "),
      style: `
        position:absolute;
        width:${GameConstants.TILE_SIZE}px;
        height:${GameConstants.TILE_SIZE}px;
        left:${data.position.x}px;
        top:${data.position.y}px;
        background-image:url('${data.sprites[data.direction]}');
        background-size:auto ${GameConstants.TILE_SIZE}px;
        background-position:-${data.frameIndex * GameConstants.TILE_SIZE}px 0px;
      `
    });
  }
}
