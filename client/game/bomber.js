import { GameConstants } from "./constant.js";
import { BombermanMapGenerator } from "./Map.js";
import { InputHandler } from "./input.js";
import { GameUI } from "./gameUI.js";
import { Player } from "./Player.js";
import { Bomb } from "./Bomb.js";

// Main game class
export class BombermanGame {
    constructor() {
        this.player = new Player(GameConstants.TILE_SIZE, GameConstants.TILE_SIZE);
        this.inputHandler = new InputHandler();
        this.ui = new GameUI();
        this.currentMap = [];
        this.hiddenPowerups = new Map();
        this.activeBombs = [];
        this.passThroughBombs = new Set();
        this.mapWidth = 15;
        this.mapHeight = 11;
        this.animationFrameId = null;
    }

    init() {
        this.generateMap();
        this.player.setElement(document.getElementById('player'));
        this.gameLoop();
    }

    generateMap() {
        const seed = 12345;
        const density = 65;
        const powerupChance = 30;

        const generator = new BombermanMapGenerator(seed, this.mapWidth, this.mapHeight, density, powerupChance);
        const result = generator.generate();
        
        this.currentMap = result.map;
        this.hiddenPowerups = result.hiddenPowerups;
        
        // Reset game state
        this.player = new Player(GameConstants.TILE_SIZE, GameConstants.TILE_SIZE);
        this.activeBombs = [];
        this.passThroughBombs.clear();
        
        this.ui.updatePlayerStatus(this.player.powerups);
        this.ui.renderMap(this.currentMap, this.mapWidth, this.mapHeight, this.hiddenPowerups);
        
        if (this.player.element) {
            this.player.updateElementPosition();
        }
    }

    gameLoop() {
        this.handleInput();
        this.updatePlayerPosition();
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    handleInput() {
        if (this.inputHandler.isBombKeyPressed()) {
            this.placeBomb();
            this.inputHandler.keysPressed[' '] = false; // Prevent spam
        }

        if (this.inputHandler.isResetKeyPressed()) {
            this.resetGame();
            this.inputHandler.keysPressed['enter'] = false;
        }
    }

    isSolid(cellType, gridX, gridY) {
        if (cellType === GameConstants.CELL_TYPES.WALL || 
            cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE) {
            return true;
        }

        if (cellType === GameConstants.CELL_TYPES.BOMB) {
            return !this.passThroughBombs.has(`${gridX},${gridY}`);
        }

        return false;
    }

    isColliding(px, py) {
        const boxLeft = px + GameConstants.COLLISION_GRACE;
        const boxRight = px + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;
        const boxTop = py + GameConstants.COLLISION_GRACE;
        const boxBottom = py + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;

        const pointsToCheck = [
            { x: boxLeft, y: boxTop },
            { x: boxRight, y: boxTop },
            { x: boxLeft, y: boxBottom },
            { x: boxRight, y: boxBottom }
        ];

        for (const point of pointsToCheck) {
            const gridX = Math.floor(point.x / GameConstants.TILE_SIZE);
            const gridY = Math.floor(point.y / GameConstants.TILE_SIZE);
            
            if (gridX < 0 || gridX >= this.mapWidth || gridY < 0 || gridY >= this.mapHeight) {
                return true;
            }
            
            if (this.isSolid(this.currentMap[gridY][gridX], gridX, gridY)) {
                return true;
            }
        }
        
        return false;
    }

    updatePlayerPosition() {
        this.updatePassThroughBombs();
        
        const movement = this.inputHandler.getMovementInput();
        let dx = movement.dx * this.player.getCurrentSpeed();
        let dy = movement.dy * this.player.getCurrentSpeed();

        // Corner assistance for horizontal movement
        if (dx !== 0 && this.isColliding(this.player.position.x + dx, this.player.position.y)) {
            const gridY = Math.floor((this.player.position.y + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE);
            const laneCenterY = gridY * GameConstants.TILE_SIZE;

            if (Math.abs(this.player.position.y - laneCenterY) <= GameConstants.CORNER_HELP_RANGE) {
                if (!this.isColliding(this.player.position.x + dx, laneCenterY)) {
                    this.player.position.y = laneCenterY;
                }
            }
        }

        // Corner assistance for vertical movement
        if (dy !== 0 && this.isColliding(this.player.position.x, this.player.position.y + dy)) {
            const gridX = Math.floor((this.player.position.x + GameConstants.TILE_SIZE / 2) / GameConstants.TILE_SIZE);
            const laneCenterX = gridX * GameConstants.TILE_SIZE;

            if (Math.abs(this.player.position.x - laneCenterX) <= GameConstants.CORNER_HELP_RANGE) {
                if (!this.isColliding(laneCenterX, this.player.position.y + dy)) {
                    this.player.position.x = laneCenterX;
                }
            }
        }

        // Apply movement
        const newX = this.player.position.x + dx;
        if (!this.isColliding(newX, this.player.position.y)) {
            this.player.position.x = newX;
        }

        const newY = this.player.position.y + dy;
        if (!this.isColliding(this.player.position.x, newY)) {
            this.player.position.y = newY;
        }

        this.player.updateElementPosition();
        this.checkPowerupCollection();
        this.player.updateAnimation(dx, dy);
    }

    updatePassThroughBombs() {
        const boxLeft = this.player.position.x + GameConstants.COLLISION_GRACE;
        const boxRight = this.player.position.x + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;
        const boxTop = this.player.position.y + GameConstants.COLLISION_GRACE;
        const boxBottom = this.player.position.y + GameConstants.TILE_SIZE - 1 - GameConstants.COLLISION_GRACE;

        for (const key of [...this.passThroughBombs]) {
            const [bx, by] = key.split(',').map(Number);
            const bombLeft = bx * GameConstants.TILE_SIZE;
            const bombRight = bombLeft + GameConstants.TILE_SIZE;
            const bombTop = by * GameConstants.TILE_SIZE;
            const bombBottom = bombTop + GameConstants.TILE_SIZE;

            const stillTouching = boxRight > bombLeft && boxLeft < bombRight && 
                                boxBottom > bombTop && boxTop < bombBottom;

            if (!stillTouching) {
                this.passThroughBombs.delete(key);
            }
        }
    }

    checkPowerupCollection() {
        const gridPos = this.player.getGridPosition();
        const cellType = this.currentMap[gridPos.y][gridPos.x];

        if ([GameConstants.CELL_TYPES.BOMB_POWERUP, 
             GameConstants.CELL_TYPES.FLAME_POWERUP, 
             GameConstants.CELL_TYPES.SPEED_POWERUP].includes(cellType)) {
            this.player.collectPowerup(cellType);
            this.currentMap[gridPos.y][gridPos.x] = GameConstants.CELL_TYPES.EMPTY;
            
            const cellElement = document.querySelector(`[data-x="${gridPos.x}"][data-y="${gridPos.y}"]`);
            if (cellElement) {
                cellElement.className = 'cell empty';
            }
            
            this.ui.updatePlayerStatus(this.player.powerups);
        }
    }

    placeBomb() {
        const gridPos = this.player.getGridPosition();
        const maxBombs = 1 + this.player.powerups.bombs;
        
        if (this.activeBombs.length >= maxBombs || 
            this.currentMap[gridPos.y][gridPos.x] === GameConstants.CELL_TYPES.BOMB) {
            return;
        }

        const bomb = new Bomb(gridPos.x, gridPos.y);
        this.currentMap[gridPos.y][gridPos.x] = GameConstants.CELL_TYPES.BOMB;
        this.activeBombs.push(bomb);
        this.passThroughBombs.add(`${gridPos.x},${gridPos.y}`);

        const cellElement = document.querySelector(`[data-x="${gridPos.x}"][data-y="${gridPos.y}"]`);
        if (cellElement) {
            cellElement.className = 'cell bomb';
        }

        bomb.startTimer((x, y) => this.explodeBomb(x, y));
    }

    explodeBomb(x, y) {
        const bomb = this.activeBombs.find(b => b.x === x && b.y === y);
        if (!bomb || bomb.exploded) return;

        bomb.explode();
        this.activeBombs = this.activeBombs.filter(b => b !== bomb);
        this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;

        const flamePower = this.player.powerups.flames + 1;
        this.handleExplosionAt(x, y);

        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        directions.forEach(([dx, dy]) => {
            for (let i = 1; i <= flamePower; i++) {
                const nx = x + dx * i;
                const ny = y + dy * i;
                
                if (!this.currentMap[ny] || this.currentMap[ny][nx] === undefined || 
                    this.currentMap[ny][nx] === GameConstants.CELL_TYPES.WALL) {
                    break;
                }

                if (this.currentMap[ny][nx] === GameConstants.CELL_TYPES.BOMB) {
                    this.explodeBomb(nx, ny);
                    break;
                }

                const shouldStop = this.currentMap[ny][nx] === GameConstants.CELL_TYPES.DESTRUCTIBLE;
                this.handleExplosionAt(nx, ny);
                if (shouldStop) break;
            }
        });
    }

    handleExplosionAt(x, y) {
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        const cellType = this.currentMap[y][x];

        // Check if player is hit
        const playerGridPos = this.player.getGridPosition();
        if (playerGridPos.x === x && playerGridPos.y === y) {
            this.player.takeDamage();
            this.ui.updatePlayerStatus(this.player.powerups);
        }

        // Handle destructible walls
        if (cellType === GameConstants.CELL_TYPES.DESTRUCTIBLE) {
            this.destroyWall(x, y);
        } else if (cellType === GameConstants.CELL_TYPES.BOMB) {
            this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
        }

        // Visual flame effect
        if (cell) {
            cell.classList.add("flame");
            setTimeout(() => {
                const finalCellType = this.currentMap[y][x];
                cell.className = 'cell';
                
                switch (finalCellType) {
                    case GameConstants.CELL_TYPES.EMPTY:
                        cell.classList.add('empty');
                        break;
                    case GameConstants.CELL_TYPES.PLAYER_SPAWN:
                        cell.classList.add('player-spawn');
                        break;
                    case GameConstants.CELL_TYPES.BOMB_POWERUP:
                        cell.classList.add('bomb-powerup');
                        break;
                    case GameConstants.CELL_TYPES.FLAME_POWERUP:
                        cell.classList.add('flame-powerup');
                        break;
                    case GameConstants.CELL_TYPES.SPEED_POWERUP:
                        cell.classList.add('speed-powerup');
                        break;
                    default:
                        cell.classList.add('empty');
                        break;
                }
            }, GameConstants.FLAME_DURATION);
        }
    }

    destroyWall(x, y) {
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell || !this.currentMap[y] || 
            this.currentMap[y][x] !== GameConstants.CELL_TYPES.DESTRUCTIBLE) {
            return;
        }

        const key = `${x},${y}`;
        if (this.hiddenPowerups.has(key)) {
            const powerupType = this.hiddenPowerups.get(key);
            this.hiddenPowerups.delete(key);
            this.currentMap[y][x] = powerupType;
            
            cell.className = 'cell';
            switch (powerupType) {
                case GameConstants.CELL_TYPES.BOMB_POWERUP:
                    cell.classList.add('bomb-powerup');
                    break;
                case GameConstants.CELL_TYPES.FLAME_POWERUP:
                    cell.classList.add('flame-powerup');
                    break;
                case GameConstants.CELL_TYPES.SPEED_POWERUP:
                    cell.classList.add('speed-powerup');
                    break;
            }
        } else {
            this.currentMap[y][x] = GameConstants.CELL_TYPES.EMPTY;
            cell.className = 'cell empty';
        }
    }

    resetGame() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.generateMap();
        this.player.setElement(document.getElementById('player'));
        this.gameLoop();
    }
}
