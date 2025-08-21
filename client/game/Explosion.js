export class Explosion {
  constructor(centerX, centerY, range) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.range = range;
  }

  affectTiles() {
    // Affect map tiles (destroy blocks)
  }

  affectPlayers(players) {
    // Damage players caught in explosion
  }
}
