import { GameConstants } from "./constant.js";
import { VNode } from "../framework/vdom.js";

export class Bomb {
  constructor(x, y, bombId, playerId) {
    this.x = x;
    this.y = y;
    this.bombId = bombId;
    this.playerId = playerId;
    this.exploded = false;
    this.timer = null;

    // Animation state
    this.frameIndex = 0;
    this.frameTick = 0;

    // constants
    this.FRAMES_PER_ANIMATION = 3;
    this.ANIMATION_SPEED = 20; // higher = slower
  }

  // يرجع VNode بدل DOM element مباشر
  render() {
    return new VNode("div", {
      class: "bomb",
      style: `
        width:${GameConstants.TILE_SIZE}px;
        height:${GameConstants.TILE_SIZE}px;
        background-image:url('media/bomb.png');
        background-size:${GameConstants.TILE_SIZE * this.FRAMES_PER_ANIMATION}px ${GameConstants.TILE_SIZE}px;
        background-position:-${this.frameIndex * GameConstants.TILE_SIZE}px 0px;
        background-repeat:no-repeat;
      `,
      "data-bomb-id": this.bombId,
      "data-player-id": this.playerId,
    });
  }

  // هادي يناديها gameLoop
  updateAnimation() {
    if (this.exploded) return;
    this.frameTick++;
    if (this.frameTick >= this.ANIMATION_SPEED) {
      this.frameIndex = (this.frameIndex + 1) % this.FRAMES_PER_ANIMATION;
      this.frameTick = 0;
    }
  }

  startTimer(callback) {
    this.timer = setTimeout(() => {
      callback(this.x, this.y);
    }, GameConstants.BOMB_TIMER);
  }

  explode() {
    this.exploded = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}
