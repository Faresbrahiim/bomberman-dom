export class Map {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = []; // 2D array of Tile instances
  }

  generateBlocks() {
    // Fill grid with walls, blocks, empty spaces
  }

  isWalkable(x, y) {
    // Return true if player can walk on this tile
  }
}
