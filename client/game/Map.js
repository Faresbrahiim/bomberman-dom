
import { GameConstants } from "./constant.js";
import { SeededRandom } from "./seededRandom.js";
// Map generator class
export class BombermanMapGenerator {
    constructor(seed, width, height, density, powerupChance) {
        this.seed = seed;
        this.width = width;
        this.height = height;
        this.density = density / 100;
        this.powerupChance = powerupChance / 100;
        this.random = new SeededRandom(seed);
        this.map = [];
        this.hiddenPowerups = new Map();
    }

    generate() {
        this.initializeMap();
        this.placePlayerSpawns();
        this.placePowerups();
        return { map: this.map, hiddenPowerups: this.hiddenPowerups };
    }

    initializeMap() {
        this.map = [];
        for (let y = 0; y < this.height; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.width; x++) {
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    this.map[y][x] = GameConstants.CELL_TYPES.WALL;
                } else if (x % 2 === 0 && y % 2 === 0) {
                    this.map[y][x] = GameConstants.CELL_TYPES.WALL;
                } else if ((x <= 2 && y <= 2) || (x >= this.width - 3 && y <= 2) || 
                          (x <= 2 && y >= this.height - 3) || (x >= this.width - 3 && y >= this.height - 3)) {
                    this.map[y][x] = GameConstants.CELL_TYPES.EMPTY;
                } else {
                    this.map[y][x] = this.random.next() < this.density ? 
                        GameConstants.CELL_TYPES.DESTRUCTIBLE : GameConstants.CELL_TYPES.EMPTY;
                }
            }
        }
    }

    placePlayerSpawns() {
        const spawns = [[1, 1], [this.width - 2, 1], [1, this.height - 2], [this.width - 2, this.height - 2]];
        spawns.forEach(([x, y]) => {
            if (this.isValidPosition(x, y)) {
                this.map[y][x] = GameConstants.CELL_TYPES.PLAYER_SPAWN;
            }
        });
    }

    placePowerups() {
        const powerupTypes = [
            GameConstants.CELL_TYPES.BOMB_POWERUP,
            GameConstants.CELL_TYPES.FLAME_POWERUP,
            GameConstants.CELL_TYPES.SPEED_POWERUP
        ];
        this.hiddenPowerups.clear();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.map[y][x] === GameConstants.CELL_TYPES.DESTRUCTIBLE && 
                    this.random.chance(this.powerupChance)) {
                    const powerupType = powerupTypes[this.random.nextInt(0, powerupTypes.length - 1)];
                    this.hiddenPowerups.set(`${x},${y}`, powerupType);
                }
            }
        }
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}