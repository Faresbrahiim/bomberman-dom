import { GameConstants } from "./constant.js";
export class Bomb {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.exploded = false;
        this.timer = null;
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