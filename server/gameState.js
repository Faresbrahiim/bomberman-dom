export class GameState {
  constructor() {
    this.players = new Map();  // key: playerId, value: player info
    this.bombs = [];
    this.map = null;           // Could be a Map instance (server-side)
  }

  addPlayer(playerData) {
    this.players.set(playerData.id, playerData);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  update() {
    // Update bombs, explosions, player states
  }

  checkWinCondition() {
    // Check if a player won the match
  }
}
