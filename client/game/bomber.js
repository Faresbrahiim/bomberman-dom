// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { GameConstants } from "./constant.js";
import { BombermanMapGenerator } from "./Map.js";
import { InputHandler } from "./input.js";
import { GameUI } from "./gameUI.js";
import { Player } from "./Player.js";
import { Bomb } from "./Bomb.js";
import { VDOMManager } from "../framework/VDOMmanager.js";
import { VNode } from "../framework/vdom.js";

// =============================================================================
// STEP 2: MAIN MULTIPLAYER GAME CLASS (DEFINED SECOND - GAME STRUCTURE)
// =============================================================================
export class BombermanGame {
  constructor(socketManager, gameData, mapContainer) {
    this.socketManager = socketManager;
    this.seed = gameData.seed;
    this.players = new Map();
    this.localPlayerId = socketManager.playerId;
    this.mapContainer = mapContainer; // <--- store this real DOM element
    const statusContainer = document.querySelector('#playerStatusArea');

    this.inputHandler = new InputHandler();
    this.ui = new GameUI(statusContainer, mapContainer); // Pass both containers
    this.currentMap = [];
    this.hiddenPowerups = new Map();
    this.activeBombs = new Map(); // bombId -> Bomb object
    this.passThroughBombs = new Set();
    this.mapWidth = 15;
    this.mapHeight = 11;
    this.animationFrameId = null;
    this.vdomManager = null; // Will hold instance

    // Initialize players from game data
    this.initializePlayers(gameData.players);

    // Set up socket event listeners
    this.setupSocketListeners();
  }

  // =============================================================================
  // STEP 3: PLAYER INITIALIZATION (DEFINED THIRD - PLAYER SETUP)
  // =============================================================================
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

  // =============================================================================
  // STEP 4: GAME INITIALIZATION (EXECUTED FOURTH - SETUP COMPLETE GAME)
  // =============================================================================
  init() {
    this.generateMap();
    this.createPlayerElements();

    // Use the real DOM element
    this.vdomManager = new VDOMManager(
      this.mapContainer,
      (state, setState) => this.renderUI(state, setState),
      {
        gameOver: false,
        leaderboard: [],
        winner: null,
        spectator: false,
        map: this.currentMap,
        players: Array.from(this.players.values()),
        bombs: Array.from(this.activeBombs.values())
      }
    );

    this.vdomManager.mount();
    this.gameLoop();
  }

  // =============================================================================
  // STEP 5: UI RENDERING FUNCTIONS (DEFINED FIFTH - VISUAL INTERFACE)
  // =============================================================================

  // --- VIRTUAL DOM UI RENDERER ---
  renderUI(state, setState) {
    const overlays = [];

    if (state.gameOver) {
      const leaderboardRows = state.leaderboard.map((player) =>
        new VNode("div", { class: `leaderboard-row rank-${player.rank}` }, [
          new VNode("span", { class: "rank" }, [
            `${this.getRankIcon(player.rank)} ${player.rank}${this.getOrdinalSuffix(player.rank)}`
          ]),
          new VNode("span", { class: "nickname" }, [player.nickname]),
          new VNode("span", { class: "lives" }, [
            player.lives > 0 ? ` (${player.lives} lives)` : " (Eliminated)"
          ])
        ])
      );

      overlays.push(
        new VNode("div", { id: "gameOverOverlay", class: "game-over-overlay" }, [
          new VNode("div", { class: "game-over-content" }, [
            new VNode("h1", { class: "game-over-title" }, ["Game Over"]),
            new VNode("h2", { class: "game-over-winner" }, [
              state.winner ? `${state.winner.nickname} Wins!` : "No Winner"
            ]),
            new VNode("h3", { class: "leaderboard-title" }, ["Final Rankings"]),
            new VNode("div", { class: "leaderboard-list" }, leaderboardRows),
            new VNode("p", { class: "return-lobby-message" }, [
              "Press Ctrl + R to restart GAME"
            ])
          ])
        ])
      );
    }

    // Wrap overlays in container
    return new VNode("div", { id: "overlayRoot" }, overlays);
  }

  // --- CREATE PLAYER VISUAL ELEMENTS ---
  createPlayerElements() {
    if (!this.mapContainer) {
      console.error("Game container not found!");
      return;
    }

    // Create an array of VNodes for all players
    const playerNodes = Array.from(this.players.values()).map((player) => {
      return new VNode(
        "div",
        {
          id: `player-${player.playerId}`,
          class: `player ${player.isLocal ? "local-player" : "remote-player"}`,
          style: `position:absolute;width:${GameConstants.TILE_SIZE}px;height:${GameConstants.TILE_SIZE}px;z-index:10;`,
        },
        []
      );
    });

    // Render all player VNodes and attach them to the map container
    playerNodes.forEach((vnode, index) => {
      const rendered = vnode.render();
      this.mapContainer.appendChild(rendered);

      const player = Array.from(this.players.values())[index];
      player.setElement(rendered);
      player.updateElementPosition();

      if (!player.isLocal) {
        player.updateAnimation(0, 0); // initial sprite for remote players
      }
    });
  }

  // =============================================================================
  // STEP 6: MAP GENERATION FUNCTIONS (DEFINED SIXTH - GAME WORLD CREATION)
  // =============================================================================

  // --- GENERATE GAME MAP ---
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

  // =============================================================================
  // STEP 7: ANIMATION SYSTEM (DEFINED SEVENTH - VISUAL UPDATES)
  // =============================================================================

  // --- UPDATE REMOTE PLAYER ANIMATIONS ---
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

  // =============================================================================
  // STEP 8: MAIN GAME LOOP (EXECUTED EIGHTH - CONTINUOUS UPDATES)
  // =============================================================================

  // --- MAIN GAME LOOP ---
  gameLoop() {
    this.handleInput();
    this.updateLocalPlayerPosition();
    this.updateRemotePlayerAnimations();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  // =============================================================================
  // STEP 9: INPUT HANDLING SYSTEM (DEFINED NINTH - PLAYER CONTROLS)
  // =============================================================================

  // --- HANDLE PLAYER INPUT ---
  handleInput() {
    const localPlayer = this.players.get(this.localPlayerId);
    if (!localPlayer) return;

    if (this.inputHandler.isBombKeyPressed()) {
      this.placeBomb();
      this.inputHandler.keysPressed[" "] = false;
    }
  }

  // =============================================================================
  // STEP 10: PLAYER MOVEMENT SYSTEM (DEFINED TENTH - POSITION UPDATES)
  // =============================================================================

  // --- UPDATE LOCAL PLAYER POSITION WITH COLLISION AND CORNER ASSISTANCE ---
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

    // Apply movement and track actual movement
    let actualDx = 0;
    let actualDy = 0;

    const newX = localPlayer.position.x + dx;
    if (!this.isColliding(newX, localPlayer.position.y)) {
      localPlayer.position.x = newX;
      actualDx = dx;
    }

    const newY = localPlayer.position.y + dy;
    if (!this.isColliding(localPlayer.position.x, newY)) {
      localPlayer.position.y = newY;
      actualDy = dy;
    }

    localPlayer.updateElementPosition();
    this.checkPowerupCollection(localPlayer);

    // Update animation based on ACTUAL movement, not input
    localPlayer.updateAnimation(actualDx, actualDy);

    // Send position update if moved
    const newGridPosition = localPlayer.getGridPosition();
    if (
      oldPosition.x !== localPlayer.position.x ||
      oldPosition.y !== localPlayer.position.y
    ) {
      // Calculate normalized movement direction based on actual movement
      const movementDirection = {
        dx: actualDx !== 0 ? (actualDx > 0 ? 1 : -1) : 0,
        dy: actualDy !== 0 ? (actualDy > 0 ? 1 : -1) : 0,
      };

      this.socketManager.sendPlayerMove(
        localPlayer.position,
        newGridPosition,
        movementDirection
      );
    }
  }

  // =============================================================================
  // STEP 11: COLLISION DETECTION SYSTEM (DEFINED ELEVENTH - PHYSICS LOGIC)
  // =============================================================================

  // --- CHECK IF CELL IS SOLID ---
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

  // --- COLLISION DETECTION ---
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

  // --- UPDATE PASS-THROUGH BOMB TRACKING ---
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

  // =============================================================================
  // STEP 12: POWERUP COLLECTION SYSTEM (DEFINED TWELFTH - ITEM PICKUP LOGIC)
  // =============================================================================

  // --- CHECK FOR POWERUP COLLECTION ---
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

      if (this.mapContainer) {
        const cellElement = this.mapContainer.querySelector(
          `[data-x="${gridPos.x}"][data-y="${gridPos.y}"]`
        );
        if (cellElement) {
          cellElement.className = "cell empty";
        }
      }

      this.ui.updateAllPlayersStatus(this.players);

      // Notify other players
      this.socketManager.sendPowerupCollected(gridPos, cellType);
    }
  }

  // --- HANDLE REMOTE POWERUP COLLECTION ---
  handlePowerupCollected(playerId, position, powerupType) {
    const player = this.players.get(playerId);
    if (player) {
      player.collectPowerup(powerupType);
      this.currentMap[position.y][position.x] = GameConstants.CELL_TYPES.EMPTY;

      if (this.mapContainer) {
        const cellElement = this.mapContainer.querySelector(
          `[data-x="${position.x}"][data-y="${position.y}"]`
        );
        if (cellElement) {
          cellElement.className = "cell empty";
        }
      }

      this.ui.updateAllPlayersStatus(this.players);
    }
  }

  // =============================================================================
  // STEP 13: BOMB PLACEMENT SYSTEM (DEFINED THIRTEENTH - EXPLOSIVE LOGIC)
  // =============================================================================

  // --- PLACE BOMB (LOCAL PLAYER) ---
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

  // --- PLACE BOMB AT POSITION ---
  placeBombAt(position, bombId, playerId) {
    const bomb = new Bomb(position.x, position.y, bombId, playerId);
    this.currentMap[position.y][position.x] = GameConstants.CELL_TYPES.BOMB;
    this.activeBombs.set(bombId, bomb);

    // Only local player gets pass-through
    if (playerId === this.localPlayerId) {
      this.passThroughBombs.add(`${position.x},${position.y}`);
    }

    if (this.mapContainer) {
      const cellElement = this.mapContainer.querySelector(
        `[data-x="${position.x}"][data-y="${position.y}"]`
      );
      if (cellElement) {
        cellElement.className = "cell bomb";
        // Set the bomb element for animation
        bomb.setElement(cellElement);
      }
    }

    // Only the bomb owner handles the explosion timing
    if (playerId === this.localPlayerId) {
      bomb.startTimer((x, y) => this.explodeBomb(x, y, bombId));
    }
  }

  // =============================================================================
  // STEP 14: EXPLOSION SYSTEM (DEFINED FOURTEENTH - BOMB DETONATION LOGIC)
  // =============================================================================

  // --- EXPLODE BOMB ---
  explodeBomb(x, y, bombId) {
    const bomb = this.activeBombs.get(bombId);
    if (!bomb || bomb.exploded) return;

    // Stop bomb animation and clean up
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

        // Don't break on bombs - let the flame pass through them
        // Chain explosion will be handled in handleExplosionAt
        const shouldStop =
          this.currentMap[ny][nx] === GameConstants.CELL_TYPES.DESTRUCTIBLE;
        if (shouldStop) break;
      }
    });

    // Handle explosion effects locally and notify others
    this.handleExplosionCells(explosionCells);
    this.socketManager.sendBombExploded(bombId, explosionCells);
  }

  // --- HANDLE REMOTE BOMB EXPLOSION ---
  handleBombExplosion(bombId, explosionCells) {
    const bomb = this.activeBombs.get(bombId);
    if (bomb) {
      bomb.explode(); // This will stop the animation
      this.activeBombs.delete(bombId);
    }

    this.handleExplosionCells(explosionCells);
  }

  // --- HANDLE EXPLOSION CELLS ---
  handleExplosionCells(explosionCells) {
    explosionCells.forEach((cell) => {
      this.handleExplosionAt(cell.x, cell.y);
    });
  }

  // --- HANDLE EXPLOSION AT SPECIFIC POSITION ---
  handleExplosionAt(x, y) {
    if (!this.mapContainer) return;

    const cellElement = this.mapContainer.querySelector(
      `[data-x="${x}"][data-y="${y}"]`
    );
    const cellType = this.currentMap[y][x];

    // Check if any player is hit
    this.players.forEach((player) => {
      const playerGridPos = player.getGridPosition();
      if (playerGridPos.x === x && playerGridPos.y === y) {
        if (player.isLocal) {
          this.handlePlayerDeath(player.playerId);
        }
      }
    });

    if (cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE) {
      this.destroyWall(x, y);
    } else if (cellType === GameConstants.CELL_TYPES.BOMB) {
      // Handle chain explosion
      const chainBomb = Array.from(this.activeBombs.values()).find(
        (b) => b.x === x && b.y === y && !b.exploded
      );
      if (chainBomb) {
        setTimeout(() => {
          if (this.activeBombs.has(chainBomb.bombId) && !chainBomb.exploded) {
            this.explodeBomb(chainBomb.x, chainBomb.y, chainBomb.bombId);
          }
        }, 100);
      }
    }

    // Visual flame effect
    if (cellElement) {
      cellElement.style.backgroundImage = "";
      cellElement.style.backgroundPosition = "";
      cellElement.style.backgroundSize = "";

      cellElement.classList.add("flame");
      setTimeout(() => {
        const finalCellType = this.currentMap[y][x];
        cellElement.className = "cell";

        cellElement.style.backgroundImage = "";
        cellElement.style.backgroundPosition = "";
        cellElement.style.backgroundSize = "";

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

  // =============================================================================
  // STEP 15: WALL DESTRUCTION SYSTEM (DEFINED FIFTEENTH - DESTRUCTIBLE BLOCKS)
  // =============================================================================

  // --- DESTROY WALL AND REVEAL POWERUPS ---
  destroyWall(x, y) {
    if (!this.mapContainer || !this.currentMap[y]) return;

    const cell = this.mapContainer.querySelector(
      `[data-x="${x}"][data-y="${y}"]`
    );

    if (!cell || this.currentMap[y][x] !== GameConstants.CELL_TYPES.DESTRUCTIBLE) {
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

  // --- HANDLE REMOTE WALL DESTRUCTION ---
  handleWallDestroyed(position, powerupRevealed) {
    const { x, y } = position;
    if (!this.mapContainer || !this.currentMap[y]) return;

    const cell = this.mapContainer.querySelector(
      `[data-x="${x}"][data-y="${y}"]`
    );
    if (!cell) return;

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

  // =============================================================================
  // STEP 16: SPECTATOR MODE SYSTEM (DEFINED SIXTEENTH - ELIMINATED PLAYER VIEW)
  // =============================================================================

  // --- ENABLE SPECTATOR MODE FOR ELIMINATED PLAYERS ---
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

  // --- SHOW SPECTATOR OVERLAY ---
  showSpectatorMessage() {
    if (!this.mapContainer) return;

    // Check if overlay already exists
    if (this.mapContainer.querySelector("#spectatorOverlay")) return;

    const overlayVNode = new VNode(
      "div",
      { id: "spectatorOverlay", class: "spectator-overlay" },
      [
        new VNode(
          "div",
          { class: "spectator-message" },
          [
            new VNode("h3", {}, ["SPECTATOR MODE"]),
            new VNode("p", {}, ["You have been eliminated. Watch the remaining players!"])
          ]
        )
      ]
    );

    // Render the VNode and append to map container
    this.mapContainer.appendChild(overlayVNode.render());
  }

  // =============================================================================
  // STEP 17: PLAYER ELIMINATION SYSTEM (DEFINED SEVENTEENTH - DEATH HANDLING)
  // =============================================================================

  // --- HANDLE PLAYER ELIMINATION NOTIFICATION ---
  handlePlayerEliminated(data) {
    if (this.chatManager) {
      const suffix = this.getOrdinalSuffix(data.eliminationOrder);
      this.chatManager.addSystemMessage(
        `${data.nickname} eliminated! Finished ${data.eliminationOrder}${suffix} place.`
      );
    }
  }

  // --- GET ORDINAL SUFFIX FOR RANKINGS ---
  getOrdinalSuffix(num) {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = num % 100;
    return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
  }

  // --- HANDLE GAME OVER STATE ---
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

  // --- HANDLE GAME RESET ---
  handleGameReset(message) {
    // Reset state
    if (this.vdomManager) {
      this.vdomManager.setState({ gameOver: false, spectator: false, leaderboard: [], winner: null });
    }

    // Reset game state as before...
    this.activeBombs.clear();
    this.passThroughBombs.clear();
    this.players.forEach((player) => {
      player.lives = 3;
      player.powerups = { bombs: 0, flames: 0, speed: 0 };
      player.removeDeadPlayerEffect();
    });
    this.inputHandler.enable();
    this.generateMap();

    if (this.chatManager) {
      this.chatManager.addSystemMessage(message);
    }
    if (!this.animationFrameId) {
      this.gameLoop();
    }
  }

  // --- SHOW LEADERBOARD OVERLAY ---
  showLeaderboard(leaderboard, winner) {
    if (this.vdomManager) {
      this.vdomManager.setState({ gameOver: true, leaderboard, winner });
    }
  }

  // --- GET RANK ICON FOR LEADERBOARD ---
  getRankIcon(rank) {
    const icons = {
      1: "🥇",
      2: "🥈",
      3: "🥉",
      4: "4️⃣",
    };
    return icons[rank] || rank;
  }

  // =============================================================================
  // STEP 18: PLAYER DEATH SYSTEM (DEFINED EIGHTEENTH - LIFE/DAMAGE LOGIC)
  // =============================================================================

  // --- HANDLE PLAYER DEATH ---
  handlePlayerDeath(playerId) {
    const player = this.players.get(playerId);
    console.log(player.lives);

    if (player && player.lives > 0) {
      // Apply damage to the player
      const tookDamage = player.takeDamage();

      if (tookDamage) {
        // Notify server about player death
        if (playerId === this.localPlayerId) {
          this.socketManager.sendPlayerDied();
        }

        // Update UI
        this.ui.updateAllPlayersStatus(this.players);
      }
    }
  }

  // =============================================================================
  // STEP 19: WEBSOCKET EVENT LISTENERS (DEFINED NINETEENTH - NETWORK COMMUNICATION)
  // =============================================================================

  // --- SETUP ALL SOCKET EVENT LISTENERS ---
  setupSocketListeners() {
    
    // --- PLAYER MOVEMENT EVENTS ---
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

    // --- BOMB PLACEMENT EVENTS ---
    this.socketManager.on("bombPlaced", (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.placeBombAt(data.position, data.bombId, data.playerId);
      }
    });

    // --- BOMB EXPLOSION EVENTS ---
    this.socketManager.on("bombExploded", (data) => {
      this.handleBombExplosion(data.bombId, data.explosionCells);
    });

    // --- WALL DESTRUCTION EVENTS ---
    this.socketManager.on("wallDestroyed", (data) => {
      this.handleWallDestroyed(data.position, data.powerupRevealed);
    });

    // --- POWERUP COLLECTION EVENTS ---
    this.socketManager.on("powerupCollected", (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.handlePowerupCollected(
          data.playerId,
          data.position,
          data.powerupType
        );
      }
    });

    // --- PLAYER DEATH EVENTS ---
    this.socketManager.on("playerDied", (data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        // Update player lives from server data
        this.handlePlayerDeath(player.playerId);
        player.lives = data.lives;

        // Apply dead player visual effect if lives reach 0
        if (data.lives === 0) {
          player.applyDeadPlayerEffect();
        }

        // Handle local player elimination
        if (data.playerId === this.localPlayerId && data.lives === 0) {
          this.enableSpectatorMode();
        }

        // Update UI for all players
        this.ui.updateAllPlayersStatus(this.players);
      }
    });

    // --- PLAYER DISCONNECTION EVENTS ---
    this.socketManager.on("playerDisconnected", (data) => {
      const player = this.players.get(data.playerId);
      if (player && player.element) {
        player.element.remove();
      }
      this.players.delete(data.playerId);
    });

    // --- GAME OVER EVENTS ---
    this.socketManager.on("gameOver", (data) => {
      this.handleGameOver(data.leaderboard, data.winner);
    });

    // --- GAME RESET EVENTS ---
    this.socketManager.on("gameReset", (message) => {
      this.handleGameReset(message);
    });

    // --- PLAYER ELIMINATION EVENTS ---
    this.socketManager.on("playerEliminated", (data) => {
      this.handlePlayerEliminated(data);
    });
  }
}