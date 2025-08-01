export class Player {
  constructor(id, nickname, position) {
    this.id = id;
    this.nickname = nickname;
    this.position = position; // {x, y}
    this.lives = 3;
    this.speed = 1;
    this.bombCount = 1;
    this.flameLength = 1;
  }

  move(direction) {
    // Move player on map
  }

  placeBomb() {
    // Place bomb on current position
  }
}
