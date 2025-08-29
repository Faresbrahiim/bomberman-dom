import { GameConstants } from "./constant.js";
import { BombermanMapGenerator } from "./Map.js";
import { InputHandler } from "./input.js";
import { GameUI } from "./gameUI.js";
import { Player } from "./Player.js";
import { Bomb } from "./Bomb.js";

// Main multiplayer game class
export class BombermanGame {
  constructor(socketManager, gameData) {
    this.socketManager = socketManager;
    this.seed = gameData.seed;
    this.players = new Map();
    this.localPlayerId = socketManager.playerId;

    this.inputHandler = new InputHandler();
    this.ui = new GameUI();
    this.currentMap = [];
    this.hiddenPowerups = new Map();
    this.activeBombs = new Map(); // bombId -> Bomb object
    this.passThroughBombs = new Set();
    this.mapWidth = 15;
    this.mapHeight = 11;
    this.animationFrameId = null;

    // Initialize players from game data
    this.initializePlayers(gameData.players);

    // Set up socket event listeners
    this.setupSocketListeners();
  }

  initializePlayers(playersData) {
    playersData.forEach((playerData) => {
      const player = new Player(
        playerData.gridPosition.x * GameConstants.TILE_SIZE,
        playerData.gridPosition.y * GameConstants.TILE_SIZE,
        playerData.playerId
      );
      player.nickname = playerData.nickname;
      player.lives = playerData.lives;
      player.powerups = playerData.powerups;
      player.isLocal = playerData.playerId === this.localPlayerId;

      this.players.set(playerData.playerId, player);
    });
  }

  setupSocketListeners() {
    this.socketManager.on("playerMoved", (data) => {
      const player = this.players.get(data.playerId);
      if (player && !player.isLocal) {
        player.position = data.position;
        player.gridPosition = data.gridPosition;
        player.updateElementPosition();

        // Apply animation with movement data
        if (data.movement) {
          player.updateAnimation(data.movement.dx, data.movement.dy);
        } else {
          // Stop animation if no movement data
          player.updateAnimation(0, 0);
        }
      }
    });

    this.socketManager.on("bombPlaced", (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.placeBombAt(data.position, data.bombId, data.playerId);
      }
    });

    this.socketManager.on("bombExploded", (data) => {
      this.handleBombExplosion(data.bombId, data.explosionCells);
    });

    this.socketManager.on("wallDestroyed", (data) => {
      this.handleWallDestroyed(data.position, data.powerupRevealed);
    });

    this.socketManager.on("powerupCollected", (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.handlePowerupCollected(
          data.playerId,
          data.position,
          data.powerupType
        );
      }
    });

    this.socketManager.on("playerDied", (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.lives = data.lives;
        this.ui.updateAllPlayersStatus(this.players);
      }
    });

    this.socketManager.on("playerDisconnected", (data) => {
      const player = this.players.get(data.playerId);
      if (player && player.element) {
        player.element.remove();
      }
      this.players.delete(data.playerId);
    });

    this.socketManager.on("gameOver", (data) => {
      this.handleGameOver(data.leaderboard, data.winner);
    });

    this.socketManager.on("gameReset", (message) => {
      this.handleGameReset(message);
    });
    this.socketManager.on("playerEliminated", (data) => {
      this.handlePlayerEliminated(data);
    });

    this.socketManager.on("playerDied", (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.lives = data.lives;

        // If this is the local player and they're eliminated
        if (data.playerId === this.localPlayerId && data.lives === 0) {
          this.enableSpectatorMode();
        }

        this.ui.updateAllPlayersStatus(this.players);
      }
    });
  }

  init() {
    this.generateMap();
    this.createPlayerElements();

    this.gameLoop();
  }

  createPlayerElements() {
    const gameContainer = document.getElementById("gameMapContainer");
    if (!gameContainer) {
      console.error("Game container not found!");
      return;
    }

    this.players.forEach((player, playerId) => {
      const playerElement = document.createElement("div");
      playerElement.id = `player-${playerId}`;
      playerElement.className = `player ${
        player.isLocal ? "local-player" : "remote-player"
      }`;
      playerElement.style.position = "absolute";
      playerElement.style.width = GameConstants.TILE_SIZE + "px";
      playerElement.style.height = GameConstants.TILE_SIZE + "px";
      playerElement.style.zIndex = "10";

      // Remove the background color - let sprites handle the appearance
      // playerElement.style.backgroundColor = this.getPlayerColor(playerId);

      gameContainer.appendChild(playerElement);
      player.setElement(playerElement);
      player.updateElementPosition();

      // Initialize sprite for remote players
      if (!player.isLocal) {
        player.updateAnimation(0, 0); // Set initial sprite
      }
    });
  }

  getPlayerColor(playerId) {
    const colors = ["#ff4444", "#4444ff", "#44ff44", "#ffff44"];
    return colors[playerId - 1] || "#ff4444";
  }

  generateMap() {
    const generator = new BombermanMapGenerator(
      this.seed,
      this.mapWidth,
      this.mapHeight,
      65,
      30
    );
    const result = generator.generate();

    this.currentMap = result.map;
    this.hiddenPowerups = result.hiddenPowerups;

    // Reset bombs
    this.activeBombs.clear();
    this.passThroughBombs.clear();

    this.ui.updateAllPlayersStatus(this.players);
    this.ui.renderMap(
      this.currentMap,
      this.mapWidth,
      this.mapHeight,
      this.hiddenPowerups
    );
  }
  updateRemotePlayerAnimations() {
    this.players.forEach((player, playerId) => {
      if (!player.isLocal && player.isMoving) {
        // Continue animation for moving remote players
        player.frameTick++;
        if (player.frameTick >= GameConstants.FRAME_SPEED) {
          player.frameIndex =
            (player.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
          player.frameTick = 0;
          player.updateSprite();
        }
      }
    });
  }
  gameLoop() {
    this.handleInput();
    this.updateLocalPlayerPosition();
    this.updateRemotePlayerAnimations();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  handleInput() {
    const localPlayer = this.players.get(this.localPlayerId);
    if (!localPlayer) return;

    if (this.inputHandler.isBombKeyPressed()) {
      this.placeBomb();
      this.inputHandler.keysPressed[" "] = false;
    }

    // Remove reset key handling - multiplayer games should be managed by server
  }

  updateLocalPlayerPosition() {
    const localPlayer = this.players.get(this.localPlayerId);
    if (!localPlayer) return;

    const oldPosition = { ...localPlayer.position };

    this.updatePassThroughBombs(localPlayer);

    const movement = this.inputHandler.getMovementInput();
    let dx = movement.dx * localPlayer.getCurrentSpeed();
    let dy = movement.dy * localPlayer.getCurrentSpeed();

    // Corner assistance for horizontal movement
    if (
      dx !== 0 &&
      this.isColliding(localPlayer.position.x + dx, localPlayer.position.y)
    ) {
      const gridY = Math.floor(
        (localPlayer.position.y + GameConstants.TILE_SIZE / 2) /
          GameConstants.TILE_SIZE
      );
      const laneCenterY = gridY * GameConstants.TILE_SIZE;

      if (
        Math.abs(localPlayer.position.y - laneCenterY) <=
        GameConstants.CORNER_HELP_RANGE
      ) {
        if (!this.isColliding(localPlayer.position.x + dx, laneCenterY)) {
          localPlayer.position.y = laneCenterY;
        }
      }
    }

    // Corner assistance for vertical movement
    if (
      dy !== 0 &&
      this.isColliding(localPlayer.position.x, localPlayer.position.y + dy)
    ) {
      const gridX = Math.floor(
        (localPlayer.position.x + GameConstants.TILE_SIZE / 2) /
          GameConstants.TILE_SIZE
      );
      const laneCenterX = gridX * GameConstants.TILE_SIZE;

      if (
        Math.abs(localPlayer.position.x - laneCenterX) <=
        GameConstants.CORNER_HELP_RANGE
      ) {
        if (!this.isColliding(laneCenterX, localPlayer.position.y + dy)) {
          localPlayer.position.x = laneCenterX;
        }
      }
    }

    // Apply movement
    const newX = localPlayer.position.x + dx;
    if (!this.isColliding(newX, localPlayer.position.y)) {
      localPlayer.position.x = newX;
    }

    const newY = localPlayer.position.y + dy;
    if (!this.isColliding(localPlayer.position.x, newY)) {
      localPlayer.position.y = newY;
    }

    localPlayer.updateElementPosition();
    this.checkPowerupCollection(localPlayer);
    localPlayer.updateAnimation(dx, dy);

    // Send position update if moved
    const newGridPosition = localPlayer.getGridPosition();
    if (
      oldPosition.x !== localPlayer.position.x ||
      oldPosition.y !== localPlayer.position.y
    ) {
      // Calculate normalized movement direction
      const movementDirection = {
        dx:
          oldPosition.x !== localPlayer.position.x
            ? localPlayer.position.x > oldPosition.x
              ? 1
              : -1
            : 0,
        dy:
          oldPosition.y !== localPlayer.position.y
            ? localPlayer.position.y > oldPosition.y
              ? 1
              : -1
            : 0,
      };

      this.socketManager.sendPlayerMove(
        localPlayer.position,
        newGridPosition,
        movementDirection
      );
    }
  }

  isSolid(cellType, gridX, gridY) {
    if (
      cellType === GameConstants.CELL_TYPES.WALL ||
      cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE
    ) {
      return true;
    }

    if (cellType === GameConstants.CELL_TYPES.BOMB) {
      return !this.passThroughBombs.has(`${gridX},${gridY}`);
    }

    return false;
  }

  isColliding(px, py) {
    const boxLeft = px + GameConstants.COLLISION_GRACE;
    const boxRight =
      px + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;
    const boxTop = py + GameConstants.COLLISION_GRACE;
    const boxBottom =
      py + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;

    const pointsToCheck = [
      { x: boxLeft, y: boxTop },
      { x: boxRight, y: boxTop },
      { x: boxLeft, y: boxBottom },
      { x: boxRight, y: boxBottom },
    ];

    for (const point of pointsToCheck) {
      const gridX = Math.floor(point.x / GameConstants.TILE_SIZE);
      const gridY = Math.floor(point.y / GameConstants.TILE_SIZE);

      if (
        gridX < 0 ||
        gridX >= this.mapWidth ||
        gridY < 0 ||
        gridY >= this.mapHeight
      ) {
        return true;
      }

      if (this.isSolid(this.currentMap[gridY][gridX], gridX, gridY)) {
        return true;
      }
    }

    return false;
  }

  updatePassThroughBombs(player) {
    const boxLeft = player.position.x + GameConstants.COLLISION_GRACE;
    const boxRight =
      player.position.x +
      GameConstants.TILE_SIZE -
      1 -
      GameConstants.COLLISION_GRACE;
    const boxTop = player.position.y + GameConstants.COLLISION_GRACE;
    const boxBottom =
      player.position.y +
      GameConstants.TILE_SIZE -
      1 -
      GameConstants.COLLISION_GRACE;

    for (const key of [...this.passThroughBombs]) {
      const [bx, by] = key.split(",").map(Number);
      const bombLeft = bx * GameConstants.TILE_SIZE;
      const bombRight = bombLeft + GameConstants.TILE_SIZE;
      const bombTop = by * GameConstants.TILE_SIZE;
      const bombBottom = bombTop + GameConstants.TILE_SIZE;

      const stillTouching =
        boxRight > bombLeft &&
        boxLeft < bombRight &&
        boxBottom > bombTop &&
        boxTop < bombBottom;

      if (!stillTouching) {
        this.passThroughBombs.delete(key);
      }
    }
  }

  checkPowerupCollection(player) {
    const gridPos = player.getGridPosition();
    const cellType = this.currentMap[gridPos.y][gridPos.x];

    if (
      [
        GameConstants.CELL_TYPES.BOMB_POWERUP,
        GameConstants.CELL_TYPES.FLAME_POWERUP,
        GameConstants.CELL_TYPES.SPEED_POWERUP,
      ].includes(cellType)
    ) {
      player.collectPowerup(cellType);
      this.currentMap[gridPos.y][gridPos.x] = GameConstants.CELL_TYPES.EMPTY;

      const cellElement = document.querySelector(
        `[data-x="${gridPos.x}"][data-y="${gridPos.y}"]`
      );
      if (cellElement) {
        cellElement.className = "cell empty";
      }

      this.ui.updateAllPlayersStatus(this.players);

      // Notify other players
      this.socketManager.sendPowerupCollected(gridPos, cellType);
    }
  }

  handlePowerupCollected(playerId, position, powerupType) {
    const player = this.players.get(playerId);
    if (player) {
      player.collectPowerup(powerupType);
      this.currentMap[position.y][position.x] = GameConstants.CELL_TYPES.EMPTY;

      const cellElement = document.querySelector(
        `[data-x="${position.x}"][data-y="${position.y}"]`
      );
      if (cellElement) {
        cellElement.className = "cell empty";
      }

      this.ui.updateAllPlayersStatus(this.players);
    }
  }

  placeBomb() {
    const localPlayer = this.players.get(this.localPlayerId);
    if (!localPlayer) return;

    const gridPos = localPlayer.getGridPosition();
    const maxBombs = 1 + localPlayer.powerups.bombs;

    // Count bombs placed by this player
    let playerBombs = 0;
    for (const bomb of this.activeBombs.values()) {
      if (bomb.playerId === this.localPlayerId) {
        playerBombs++;
      }
    }

    if (
      playerBombs >= maxBombs ||
      this.currentMap[gridPos.y][gridPos.x] === GameConstants.CELL_TYPES.BOMB
    ) {
      return;
    }

    const bombId = `${this.localPlayerId}_${Date.now()}`;
    this.placeBombAt(gridPos, bombId, this.localPlayerId);

    // Notify other players
    this.socketManager.sendPlaceBomb(gridPos);
  }

  placeBombAt(position, bombId, playerId) {
    const bomb = new Bomb(position.x, position.y, bombId, playerId);
    this.currentMap[position.y][position.x] = GameConstants.CELL_TYPES.BOMB;
    this.activeBombs.set(bombId, bomb);

    // Only local player gets pass-through
    if (playerId === this.localPlayerId) {
      this.passThroughBombs.add(`${position.x},${position.y}`);
    }

    const cellElement = document.querySelector(
      `[data-x="${position.x}"][data-y="${position.y}"]`
    );
    if (cellElement) {
      cellElement.className = "cell bomb";
    }

    // Only the bomb owner handles the explosion timing
    if (playerId === this.localPlayerId) {
      bomb.startTimer((x, y) => this.explodeBomb(x, y, bombId));
    }
  }

  explodeBomb(x, y, bombId) {
    const bomb = this.activeBombs.get(bombId);
    if (!bomb || bomb.exploded) return;

    bomb.explode();
    this.activeBombs.delete(bombId);
    this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;

    const player = this.players.get(bomb.playerId);
    const flamePower = player ? player.powerups.flames + 1 : 1;

    const explosionCells = [];
    explosionCells.push({ x, y });

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    directions.forEach(([dx, dy]) => {
      for (let i = 1; i <= flamePower; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;

        if (
          !this.currentMap[ny] ||
          this.currentMap[ny][nx] === undefined ||
          this.currentMap[ny][nx] === GameConstants.CELL_TYPES.WALL
        ) {
          break;
        }

        explosionCells.push({ x: nx, y: ny });

        if (this.currentMap[ny][nx] === GameConstants.CELL_TYPES.BOMB) {
          // Chain explosion - let the other bomb's owner handle it
          break;
        }

        const shouldStop =
          this.currentMap[ny][nx] === GameConstants.CELL_TYPES.DESTRUCTIBLE;
        if (shouldStop) break;
      }
    });

    // Handle explosion effects locally and notify others
    this.handleExplosionCells(explosionCells);
    this.socketManager.sendBombExploded(bombId, explosionCells);
  }

  handleBombExplosion(bombId, explosionCells) {
    const bomb = this.activeBombs.get(bombId);
    if (bomb) {
      bomb.explode();
      this.activeBombs.delete(bombId);
    }

    this.handleExplosionCells(explosionCells);
  }

  handleExplosionCells(explosionCells) {
    explosionCells.forEach((cell) => {
      this.handleExplosionAt(cell.x, cell.y);
    });
  }

  handleExplosionAt(x, y) {
    const cellElement = document.querySelector(
      `[data-x="${x}"][data-y="${y}"]`
    );
    const cellType = this.currentMap[y][x];

    // Check if any player is hit
    this.players.forEach((player) => {
      const playerGridPos = player.getGridPosition();
      if (playerGridPos.x === x && playerGridPos.y === y) {
        if (player.isLocal) {
          player.takeDamage();
          this.socketManager.sendPlayerDied();
        }
        player.lives--;
        this.ui.updateAllPlayersStatus(this.players);
      }
    });

    // Handle destructible walls
    if (cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE) {
      this.destroyWall(x, y);
    } else if (cellType === GameConstants.CELL_TYPES.BOMB) {
      this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
    }

    // Visual flame effect
    if (cellElement) {
      cellElement.classList.add("flame");
      setTimeout(() => {
        const finalCellType = this.currentMap[y][x];
        cellElement.className = "cell";

        switch (finalCellType) {
          case GameConstants.CELL_TYPES.EMPTY:
            cellElement.classList.add("empty");
            break;
          case GameConstants.CELL_TYPES.PLAYER_SPAWN:
            cellElement.classList.add("player-spawn");
            break;
          case GameConstants.CELL_TYPES.BOMB_POWERUP:
            cellElement.classList.add("bomb-powerup");
            break;
          case GameConstants.CELL_TYPES.FLAME_POWERUP:
            cellElement.classList.add("flame-powerup");
            break;
          case GameConstants.CELL_TYPES.SPEED_POWERUP:
            cellElement.classList.add("speed-powerup");
            break;
          default:
            cellElement.classList.add("empty");
            break;
        }
      }, GameConstants.FLAME_DURATION);
    }
  }

  destroyWall(x, y) {
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (
      !cell ||
      !this.currentMap[y] ||
      this.currentMap[y][x] !== GameConstants.CELL_TYPES.DESTRUCTIBLE
    ) {
      return;
    }

    const key = `${x},${y}`;
    let powerupRevealed = null;

    if (this.hiddenPowerups.has(key)) {
      const powerupType = this.hiddenPowerups.get(key);
      this.hiddenPowerups.delete(key);
      this.currentMap[y][x] = powerupType;
      powerupRevealed = powerupType;

      cell.className = "cell";
      switch (powerupType) {
        case GameConstants.CELL_TYPES.BOMB_POWERUP:
          cell.classList.add("bomb-powerup");
          break;
        case GameConstants.CELL_TYPES.FLAME_POWERUP:
          cell.classList.add("flame-powerup");
          break;
        case GameConstants.CELL_TYPES.SPEED_POWERUP:
          cell.classList.add("speed-powerup");
          break;
      }
    } else {
      this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
      cell.className = "cell empty";
    }

    // Notify other players about wall destruction
    this.socketManager.sendWallDestroyed({ x, y }, powerupRevealed);
  }

  handleWallDestroyed(position, powerupRevealed) {
    const { x, y } = position;
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);

    if (powerupRevealed) {
      this.currentMap[y][x] = powerupRevealed;
      cell.className = "cell";
      switch (powerupRevealed) {
        case GameConstants.CELL_TYPES.BOMB_POWERUP:
          cell.classList.add("bomb-powerup");
          break;
        case GameConstants.CELL_TYPES.FLAME_POWERUP:
          cell.classList.add("flame-powerup");
          break;
        case GameConstants.CELL_TYPES.SPEED_POWERUP:
          cell.classList.add("speed-powerup");
          break;
      }
    } else {
      this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
      cell.className = "cell empty";
    }
  }
  enableSpectatorMode() {
    // Disable input but keep game loop running for spectating
    this.inputHandler.disable();

    // Show spectator message
    this.showSpectatorMessage();

    if (this.chatManager) {
      this.chatManager.addSystemMessage(
        "You are now spectating. Watch the remaining players!"
      );
    }
  }
  showSpectatorMessage() {
    const gameContainer = document.getElementById("gameMapContainer");
    if (!gameContainer) return;
  
    // Remove existing spectator overlay if any
    const existingOverlay = document.getElementById("spectatorOverlay");
    if (existingOverlay) return; // Already showing
  
    const overlay = document.createElement("div");
    overlay.id = "spectatorOverlay";
    overlay.className = "spectator-overlay";
    
    const message = document.createElement("div");
    message.className = "spectator-message";
    message.innerHTML = "<h3>SPECTATOR MODE</h3><p>You have been eliminated. Watch the remaining players!</p>";
    
    overlay.appendChild(message);
    gameContainer.appendChild(overlay);
  }
  
  handlePlayerEliminated(data) {
    if (this.chatManager) {
      const suffix = this.getOrdinalSuffix(data.eliminationOrder);
      this.chatManager.addSystemMessage(`${data.nickname} eliminated! Finished ${data.eliminationOrder}${suffix} place.`);
    }
  }


  getOrdinalSuffix(num) {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = num % 100;
    return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
  }
  handleGameOver(leaderboard, winner) {
    // Stop the game loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  
    // Create game over screen with leaderboard
    this.showLeaderboard(leaderboard, winner);
    
    // Disable input for all players
    this.inputHandler.disable();
  }

  showGameOverScreen(winner, message) {
    const gameContainer = document.getElementById("gameMapContainer");
    if (!gameContainer) return;

    // Remove existing overlay if any
    const existingOverlay = document.getElementById("gameOverOverlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "gameOverOverlay";
    overlay.className = "game-over-overlay";

    const content = document.createElement("div");
    content.className = "game-over-content";

    const title = document.createElement("h1");
    title.className = "game-over-title";
    title.textContent = "Game Over";

    const winnerText = document.createElement("h2");
    winnerText.className = "game-over-winner";
    winnerText.textContent = message;

    const restartText = document.createElement("p");
    restartText.className = "game-over-restart";
    restartText.textContent = "Starting new game in 5 seconds...";

    content.appendChild(title);
    content.appendChild(winnerText);
    content.appendChild(restartText);
    overlay.appendChild(content);

    gameContainer.appendChild(overlay);
  }
  handleGameReset(message) {
    // Remove all overlays
    const gameOverOverlay = document.getElementById("gameOverOverlay");
    if (gameOverOverlay) gameOverOverlay.remove();

    const spectatorOverlay = document.getElementById("spectatorOverlay");
    if (spectatorOverlay) spectatorOverlay.remove();

    // Reset game state
    this.activeBombs.clear();
    this.passThroughBombs.clear();

    // Reset players to initial state
    this.players.forEach((player, playerId) => {
      player.lives = 3;
      player.powerups = { bombs: 0, flames: 0, speed: 0 };
    });

    // Re-enable input for all players
    this.inputHandler.enable();

    // Regenerate map
    this.generateMap();

    // Show reset message
    if (this.chatManager) {
      this.chatManager.addSystemMessage(message);
    }

    // Restart game loop
    if (!this.animationFrameId) {
      this.gameLoop();
    }
  }
  enableSpectatorMode() {
    // Disable input but keep game loop running for spectating
    this.inputHandler.disable();

    // Show spectator message
    this.showSpectatorMessage();

    if (this.chatManager) {
      this.chatManager.addSystemMessage(
        "You are now spectating. Watch the remaining players!"
      );
    }
  }
  showSpectatorMessage() {
    const gameContainer = document.getElementById("gameMapContainer");
    if (!gameContainer) return;

    // Remove existing spectator overlay if any
    const existingOverlay = document.getElementById("spectatorOverlay");
    if (existingOverlay) return; // Already showing

    const overlay = document.createElement("div");
    overlay.id = "spectatorOverlay";
    overlay.className = "spectator-overlay";

    const message = document.createElement("div");
    message.className = "spectator-message";
    message.innerHTML =
      "<h3>SPECTATOR MODE</h3><p>You have been eliminated. Watch the remaining players!</p>";

    overlay.appendChild(message);
    gameContainer.appendChild(overlay);
  }
  showLeaderboard(leaderboard, winner) {
    const gameContainer = document.getElementById("gameMapContainer");
    if (!gameContainer) return;
  
    // Remove existing overlays
    const existingOverlay = document.getElementById("gameOverOverlay");
    if (existingOverlay) existingOverlay.remove();
    
    const spectatorOverlay = document.getElementById("spectatorOverlay");
    if (spectatorOverlay) spectatorOverlay.remove();
  
    // Create leaderboard overlay
    const overlay = document.createElement("div");
    overlay.id = "gameOverOverlay";
    overlay.className = "game-over-overlay";
    
    const content = document.createElement("div");
    content.className = "game-over-content";
    
    const title = document.createElement("h1");
    title.className = "game-over-title";
    title.textContent = "Game Over";
    
    const winnerText = document.createElement("h2");
    winnerText.className = "game-over-winner";
    winnerText.textContent = winner ? `${winner.nickname} Wins!` : "No Winner";
    
    const leaderboardTitle = document.createElement("h3");
    leaderboardTitle.className = "leaderboard-title";
    leaderboardTitle.textContent = "Final Rankings";
    
    const leaderboardList = document.createElement("div");
    leaderboardList.className = "leaderboard-list";
    
    leaderboard.forEach((player) => {
      const playerRow = document.createElement("div");
      playerRow.className = `leaderboard-row rank-${player.rank}`;
      
      const rankIcon = this.getRankIcon(player.rank);
      const livesText = player.lives > 0 ? ` (${player.lives} lives)` : " (Eliminated)";
      
      playerRow.innerHTML = `
        <span class="rank">${rankIcon} ${player.rank}${this.getOrdinalSuffix(player.rank)}</span>
        <span class="nickname">${player.nickname}</span>
        <span class="lives">${livesText}</span>
      `;
      
      leaderboardList.appendChild(playerRow);
    });
    
    const returnMessage = document.createElement("p");
    returnMessage.className = "return-lobby-message";
    returnMessage.textContent = "Returning to lobby in 5 seconds...";
    
    content.appendChild(title);
    content.appendChild(winnerText);
    content.appendChild(leaderboardTitle);
    content.appendChild(leaderboardList);
    content.appendChild(returnMessage);
    overlay.appendChild(content);
    
    gameContainer.appendChild(overlay);
  }
  getRankIcon(rank) {
    const icons = {
      1: "🥇",
      2: "🥈", 
      3: "🥉",
      4: "4️⃣"
    };
    return icons[rank] || rank;
  }
}
