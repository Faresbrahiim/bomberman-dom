import { GameConstants } from "./constant.js";
import { BombermanMapGenerator } from "./Map.js";
import { InputHandler } from "./input.js";
import { GameUI } from "./gameUI.js";
import { Player } from "./Player.js";
import { Bomb } from "./Bomb.js";
import { VNode } from "../framework/vdom.js";

export class BombermanGame {
  constructor(socketManager, gameData, eventRegistry, vdom) {
    // networking
    this.socketManager = socketManager;
    this.seed = gameData.seed;
    this.localPlayerId = socketManager.playerId;

    // framework
    this.eventRegistry = eventRegistry;
    this.vdom = vdom;
    this.inputHandler = new InputHandler(this.eventRegistry);
    this.ui = new GameUI();

    // world state
    this.players = new Map();
    this.currentMap = [];
    this.hiddenPowerups = new Map();
    this.activeBombs = new Map(); // bombId -> Bomb
    this.passThroughBombs = new Set();
    this.mapWidth = 15;
    this.mapHeight = 11;
    this.animationFrameId = null;

    // overlay management
    this.overlayElements = new Map(); // Track overlays using framework

    // players from lobby/gameData
    this.initializePlayers(gameData.players);

    // sockets
    this.setupSocketListeners();
  }

  // ---------- RENDER ----------
  render() {
    const W = this.mapWidth * GameConstants.TILE_SIZE;
    const H = this.mapHeight * GameConstants.TILE_SIZE;

    const mapVNode = this.ui.renderMap(
      this.currentMap,
      this.mapWidth,
      this.mapHeight,
      this.hiddenPowerups
    );

    const bombsVNode = new VNode(
      "div",
      {
        class: "layer bombs-layer",
        style: "position:absolute;inset:0;z-index:5;pointer-events:none;",
      },
      Array.from(this.activeBombs.values()).map((b) => b.render())
    );

    const playersVNode = new VNode(
      "div",
      {
        class: "layer players-layer",
        style: "position:absolute;inset:0;z-index:10;pointer-events:none;",
      },
      Array.from(this.players.values()).map((p) => p.render())
    );

    const hudVNode = new VNode("div", { ref: "playerStatusArea" }, [
      this.ui.renderPlayersStatus(this.players),
    ]);

    // Game container with reference for overlay management
    const gameContainer = new VNode(
      "div",
      {
        ref: "gameMapContainer",
        id: "game-root",
        style: `position:relative;width:${W}px;height:${H}px;margin:0 auto;`,
      },
      [
        mapVNode,
        bombsVNode,
        playersVNode,
        hudVNode,
        // Hidden input for keyboard capture with framework reference
        new VNode("input", {
          ref: "game-keyboard-input",
          type: "hidden",
          "data-game-input": "true",
          style: "position:absolute;left:-9999px;"
        })
      ]
    );

    return gameContainer;
  }

  requestRender() {
    // Force a re-render
    this.vdom.setState({ tick: (this.vdom.state?.tick || 0) + 1 });
  }

  // ---------- LIFECYCLE ----------
  init() {
    this.generateMap();
    this.vdom.mount(); // initial paint

    this.inputHandler.enable();
    
    // Focus the game input element through framework
    this.focusGameInput();

    this.gameLoop();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.inputHandler.destroy();
    if (this.vdom) {
      this.vdom.unmount();
    }
  }

  // Focus game input using framework reference
  focusGameInput() {
    const gameInput = this.vdom.getRef("game-keyboard-input");
    if (gameInput) {
      gameInput.focus();
    }
  }

  // Get game map container using framework reference
  getGameMapContainer() {
    return this.vdom.getRef("gameMapContainer");
  }

  // Create overlay using framework system
  createOverlay(overlayId, overlayClass, content) {
    const container = this.getGameMapContainer();
    if (!container) return null;

    // Remove existing overlay if it exists
    this.removeOverlay(overlayId);

    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = overlayClass;
    overlay.innerHTML = content;
    
    container.appendChild(overlay);
    
    // Register with framework for future reference
    this.vdom.registerRef(overlayId, overlay);
    
    return overlay;
  }

  // Remove overlay using framework system
  removeOverlay(overlayId) {
    const overlay = this.vdom.getRef(overlayId);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      this.vdom.unregisterRef(overlayId);
    }
  }

  // ---------- PLAYERS ----------
  initializePlayers(playersData) {
    playersData.forEach((pd) => {
      const px = pd.gridPosition.x * GameConstants.TILE_SIZE;
      const py = pd.gridPosition.y * GameConstants.TILE_SIZE;
      const player = new Player(px, py, pd.playerId);
      player.nickname = pd.nickname;
      player.lives = pd.lives;
      player.powerups = pd.powerups;
      player.isLocal = pd.playerId === this.localPlayerId;
      this.players.set(pd.playerId, player);
    });
  }

  // ---------- SOCKETS ----------
  setupSocketListeners() {
    this.socketManager.on("playerMoved", (data) => {
      const p = this.players.get(data.playerId);
      if (p && !p.isLocal) {
        p.position = data.position;
        p.updateAnimation(data.movement?.dx || 0, data.movement?.dy || 0);
        this.requestRender();
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
        // Update player lives from server data
        this.handlePlayerDeath(player.playerId);
        player.lives = data.lives;

        // Handle local player elimination
        if (data.playerId === this.localPlayerId && data.lives === 0) {
          this.enableSpectatorMode();
        }

        // Update UI for all players
        this.ui.updateAllPlayersStatus(this.players);
      }
    });

    this.socketManager.on("playerDisconnected", (data) => {
      this.players.delete(data.playerId);
      this.requestRender();
    });

    this.socketManager.on("gameOver", (data) => {
      this.handleGameOver(data.leaderboard, data.winner);
    });

    this.socketManager.on("playerEliminated", (data) =>
      this.handlePlayerEliminated(data)
    );
  }

  // ---------- MAP ----------
  generateMap() {
    const gen = new BombermanMapGenerator(
      this.seed,
      this.mapWidth,
      this.mapHeight,
      65,
      30
    );
    const result = gen.generate();
    this.currentMap = result.map;
    this.hiddenPowerups = result.hiddenPowerups;

    this.activeBombs.clear();
    this.passThroughBombs.clear();

    // Trigger re-render
    this.requestRender();
  }

  // ---------- LOOP ----------
  gameLoop() {
    this.handleInput();
    this.updateLocalPlayerPosition();
    this.updateAnimations();
    this.requestRender();
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  updateAnimations() {
    // Remote players keep animating while moving
    this.players.forEach((p) => {
      if (!p.isLocal && p.isMoving) {
        p.frameTick++;
        if (p.frameTick >= GameConstants.FRAME_SPEED) {
          p.frameIndex = (p.frameIndex + 1) % GameConstants.FRAMES_PER_ROW;
          p.frameTick = 0;
        }
      }
    });
    // Bomb sprites
    this.activeBombs.forEach((b) => b.updateAnimation());
  }

  // ---------- INPUT & MOVEMENT ----------
  handleInput() {
    const me = this.players.get(this.localPlayerId);
    if (!me || me.dead || me.lives <= 0) {
      return;
    }

    if (this.inputHandler.isBombKeyPressed()) {
      this.placeBomb();
      // clear key so it's not spammed
      this.inputHandler.keysPressed[" "] = false;
      this.inputHandler.keysPressed["spacebar"] = false;
    }
  }

  updateLocalPlayerPosition() {
    const me = this.players.get(this.localPlayerId);
    if (!me || me.dead || me.lives <= 0) return;

    const old = { ...me.position };
    this.updatePassThroughBombs(me);

    const mv = this.inputHandler.getMovementInput();
    let dx = mv.dx * me.getCurrentSpeed();
    let dy = mv.dy * me.getCurrentSpeed();

    // corner assist (horizontal)
    if (dx !== 0 && this.isColliding(me.position.x + dx, me.position.y)) {
      const gridY = Math.floor(
        (me.position.y + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE
      );
      const laneY = gridY * GameConstants.TILE_SIZE;
      if (
        Math.abs(me.position.y - laneY) <= GameConstants.CORNER_HELP_RANGE &&
        !this.isColliding(me.position.x + dx, laneY)
      ) {
        me.position.y = laneY;
      }
    }
    // corner assist (vertical)
    if (dy !== 0 && this.isColliding(me.position.x, me.position.y + dy)) {
      const gridX = Math.floor(
        (me.position.x + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE
      );
      const laneX = gridX * GameConstants.TILE_SIZE;
      if (
        Math.abs(me.position.x - laneX) <= GameConstants.CORNER_HELP_RANGE &&
        !this.isColliding(laneX, me.position.y + dy)
      ) {
        me.position.x = laneX;
      }
    }

    // apply movement if not colliding
    let actualDx = 0,
      actualDy = 0;
    const nx = me.position.x + dx;
    if (!this.isColliding(nx, me.position.y)) {
      me.position.x = nx;
      actualDx = dx;
    }
    const ny = me.position.y + dy;
    if (!this.isColliding(me.position.x, ny)) {
      me.position.y = ny;
      actualDy = dy;
    }

    // powerups + animation
    this.checkPowerupCollection(me);
    me.updateAnimation(actualDx, actualDy);

    // broadcast if moved
    if (old.x !== me.position.x || old.y !== me.position.y) {
      const grid = me.getGridPosition();
      const dir = {
        dx: actualDx ? (actualDx > 0 ? 1 : -1) : 0,
        dy: actualDy ? (actualDy > 0 ? 1 : -1) : 0,
      };
      this.socketManager.sendPlayerMove(me.position, grid, dir);
    }
  }

  // ---------- COLLISIONS ----------
  isSolid(cellType, gx, gy) {
    if (
      cellType === GameConstants.CELL_TYPES.WALL ||
      cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE
    )
      return true;
    if (cellType === GameConstants.CELL_TYPES.BOMB) {
      return !this.passThroughBombs.has(`${gx},${gy}`);
    }
    return false;
  }

  isColliding(px, py) {
    const left = px + GameConstants.COLLISION_GRACE;
    const right =
      px + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;
    const top = py + GameConstants.COLLISION_GRACE;
    const bottom =
      py + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;

    const points = [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ];

    for (const p of points) {
      const gx = Math.floor(p.x / GameConstants.TILE_SIZE);
      const gy = Math.floor(p.y / GameConstants.TILE_SIZE);
      if (gx < 0 || gx >= this.mapWidth || gy < 0 || gy >= this.mapHeight)
        return true;
      if (this.isSolid(this.currentMap[gy][gx], gx, gy)) return true;
    }
    return false;
  }

  updatePassThroughBombs(player) {
    const left = player.position.x + GameConstants.COLLISION_GRACE;
    const right =
      player.position.x +
      GameConstants.TILE_SIZE -
      1 -
      GameConstants.COLLISION_GRACE;
    const top = player.position.y + GameConstants.COLLISION_GRACE;
    const bottom =
      player.position.y +
      GameConstants.TILE_SIZE -
      1 -
      GameConstants.COLLISION_GRACE;

    for (const key of [...this.passThroughBombs]) {
      const [bx, by] = key.split(",").map(Number);
      const bLeft = bx * GameConstants.TILE_SIZE;
      const bRight = bLeft + GameConstants.TILE_SIZE;
      const bTop = by * GameConstants.TILE_SIZE;
      const bBottom = bTop + GameConstants.TILE_SIZE;

      const still =
        right > bLeft && left < bRight && bottom > bTop && top < bBottom;
      if (!still) this.passThroughBombs.delete(key);
    }
  }

  // ---------- POWERUPS ----------
  checkPowerupCollection(player) {
    const g = player.getGridPosition();
    if (g.y < 0 || g.y >= this.mapHeight || g.x < 0 || g.x >= this.mapWidth)
      return;

    const t = this.currentMap[g.y][g.x];
    if (
      [
        GameConstants.CELL_TYPES.BOMB_POWERUP,
        GameConstants.CELL_TYPES.FLAME_POWERUP,
        GameConstants.CELL_TYPES.SPEED_POWERUP,
      ].includes(t)
    ) {
      player.collectPowerup(t);
      this.currentMap[g.y][g.x] = GameConstants.CELL_TYPES.EMPTY;
      this.socketManager.sendPowerupCollected(g, t);
      this.requestRender();
    }
  }

  handlePowerupCollected(playerId, pos, type) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.collectPowerup(type);
    this.currentMap[pos.y][pos.x] = GameConstants.CELL_TYPES.EMPTY;
    this.requestRender();
  }

  // ---------- BOMBS ----------
  placeBomb() {
    const me = this.players.get(this.localPlayerId);
    if (!me || me.dead || me.lives <= 0) return;

    const g = me.getGridPosition();
    if (g.y < 0 || g.y >= this.mapHeight || g.x < 0 || g.x >= this.mapWidth)
      return;

    const maxBombs = 1 + me.powerups.bombs;

    let mine = 0;
    for (const b of this.activeBombs.values())
      if (b.playerId === this.localPlayerId) mine++;
    if (
      mine >= maxBombs ||
      this.currentMap[g.y][g.x] === GameConstants.CELL_TYPES.BOMB
    )
      return;

    const bombId = `${this.localPlayerId}_${Date.now()}`;
    this.placeBombAt(g, bombId, this.localPlayerId);
    this.socketManager.sendPlaceBomb(g);
  }

  placeBombAt(pos, bombId, playerId) {
    const b = new Bomb(pos.x, pos.y, bombId, playerId);
    this.currentMap[pos.y][pos.x] = GameConstants.CELL_TYPES.BOMB;
    this.activeBombs.set(bombId, b);

    if (playerId === this.localPlayerId) {
      this.passThroughBombs.add(`${pos.x},${pos.y}`);
      b.startTimer((x, y) => this.explodeBomb(x, y, bombId));
    }
    this.requestRender();
  }

  explodeBomb(x, y, bombId) {
    const b = this.activeBombs.get(bombId);
    if (!b || b.exploded) return;

    b.explode();
    this.activeBombs.delete(bombId);
    this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;

    const owner = this.players.get(b.playerId);
    const range = owner ? owner.powerups.flames + 1 : 1;

    const cells = [{ x, y }];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    dirs.forEach(([dx, dy]) => {
      for (let i = 1; i <= range; i++) {
        const nx = x + dx * i,
          ny = y + dy * i;
        if (
          !this.currentMap[ny] ||
          this.currentMap[ny][nx] == null ||
          this.currentMap[ny][nx] === GameConstants.CELL_TYPES.WALL
        )
          break;

        cells.push({ x: nx, y: ny });
        if (this.currentMap[ny][nx] === GameConstants.CELL_TYPES.DESTRUCTIBLE)
          break;
      }
    });

    this.handleExplosionCells(cells);
    this.socketManager.sendBombExploded(bombId, cells);
    this.players.forEach((p) => {
      const g = p.getGridPosition();
      if (g.x === x && g.y === y && p.isLocal) {
        this.socketManager.sendPlayerDied();
      }
    });
    this.requestRender();
  }

  handleBombExplosion(bombId, cells) {
    const b = this.activeBombs.get(bombId);
    if (b) {
      b.explode();
      this.activeBombs.delete(bombId);
    }
    this.handleExplosionCells(cells);
    this.requestRender();
  }

  handleExplosionCells(cells) {
    cells.forEach((c) => this.handleExplosionAt(c.x, c.y));
  }

  handleExplosionAt(x, y) {
    // player hits
    console.log(this.players);

    const type = this.currentMap[y][x];
    if (type === GameConstants.CELL_TYPES.DESTRUCTIBLE) {
      this.destroyWall(x, y);
    } else if (type === GameConstants.CELL_TYPES.BOMB) {
      const chain = [...this.activeBombs.values()].find(
        (b) => b.x === x && b.y === y && !b.exploded
      );
      if (chain)
        setTimeout(() => {
          if (this.activeBombs.has(chain.bombId) && !chain.exploded) {
            this.explodeBomb(chain.x, chain.y, chain.bombId);
          }
        }, 100);
    }

    // Visual flame effect through framework
    this.createFlameEffect(x, y);
  }

  // Create flame effect using framework system
  createFlameEffect(x, y) {
    setTimeout(() => {
      // Find the cell element through the framework
      const gameContainer = this.getGameMapContainer();
      if (gameContainer) {
        const cell = gameContainer.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
          cell.classList.add("flame");
          setTimeout(() => {
            cell.classList.remove("flame");
          }, GameConstants.FLAME_DURATION);
        }
      }
    }, 50);
  }

  destroyWall(x, y) {
    const key = `${x},${y}`;
    let revealed = null;

    if (this.hiddenPowerups.has(key)) {
      revealed = this.hiddenPowerups.get(key);
      this.hiddenPowerups.delete(key);
      this.currentMap[y][x] = revealed;
    } else {
      this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
    }

    this.socketManager.sendWallDestroyed({ x, y }, revealed);
    this.requestRender();
  }

  handleWallDestroyed(pos, revealed) {
    if (revealed) {
      this.currentMap[pos.y][pos.x] = revealed;
    } else {
      this.currentMap[pos.y][pos.x] = GameConstants.CELL_TYPES.EMPTY;
    }
    this.requestRender();
  }

  // ---------- SPECTATOR / GAME OVER ----------
  enableSpectatorMode() {
    this.inputHandler.disable();
    this.showSpectatorMessage();
  }

  showSpectatorMessage() {
    const overlayContent = `<div class="spectator-message">
      <h3>SPECTATOR MODE</h3>
      <p>You have been eliminated. Watch the remaining players!</p>
    </div>`;
    
    this.createOverlay("spectatorOverlay", "spectator-overlay", overlayContent);
  }

  handlePlayerEliminated(data) {
    if (this.chatManager) {
      const s = this.getOrdinalSuffix(data.eliminationOrder);
      this.chatManager.addSystemMessage(
        `${data.nickname} eliminated! Finished ${data.eliminationOrder}${s} place.`
      );
    }
  }

  getOrdinalSuffix(n) {
    const suf = ["th", "st", "nd", "rd"],
      v = n % 100;
    return suf[(v - 20) % 10] || suf[v] || suf[0];
  }

  handleGameOver(leaderboard, winner) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.inputHandler.disable();

    // Remove existing game over overlay if it exists
    this.removeOverlay("gameOverOverlay");

    const overlayContent = `
      <div class="game-over-content">
        <h1 class="game-over-title">Game Over</h1>
        <h2 class="game-over-winner">${
          winner ? `${winner.nickname} Wins!` : "No Winner"
        }</h2>
        <h3 class="leaderboard-title">Final Rankings</h3>
        <div class="leaderboard-list">
          ${leaderboard
            .map(
              (p) => `
            <div class="leaderboard-row rank-${p.rank}">
              <span class="rank">${this.getRankIcon(p.rank)} ${
                p.rank
              }${this.getOrdinalSuffix(p.rank)}</span>
              <span class="nickname">${p.nickname}</span>
              <span class="lives">${
                p.lives > 0 ? ` (${p.lives} lives)` : " (Eliminated)"
              }</span>
            </div>`
            )
            .join("")}
        </div>
        <p class="return-lobby-message">Press Ctrl + R to restart GAME</p>
      </div>
    `;

    this.createOverlay("gameOverOverlay", "game-over-overlay", overlayContent);
  }

  getRankIcon(rank) {
    const icons = { 1: "🥇", 2: "🥈", 3: "🥉", 4: "4️⃣" };
    return icons[rank] || rank;
  }

  handlePlayerDeath(data) {
    const p = this.players.get(data);
    if (p && p.lives > 0) {
      const took = p.takeDamage();
      console.log(took);
      this.requestRender();
    }
  }
}