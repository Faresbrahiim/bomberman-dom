export class Bomb {
  constructor(x, y, ownerId, range) {
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
    this.range = range;
    this.timer = 3000; // milliseconds until explosion
  }

  startCountdown() {
    // Start bomb timer
  }

  explode() {
    // Handle explosion logic
  }
}
