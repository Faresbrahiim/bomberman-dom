export class PowerUp {
  constructor(type, x, y) {
    this.type = type; // "bomb", "flame", "speed"
    this.x = x;
    this.y = y;
  }

  applyTo(player) {
    // Apply power-up effect to player
  }
}
