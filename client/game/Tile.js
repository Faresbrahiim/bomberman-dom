export class Tile {
  constructor(type = "empty", hasPowerUp = false) {
    this.type = type; // "empty", "wall", "block"
    this.hasPowerUp = hasPowerUp;
  }
}
