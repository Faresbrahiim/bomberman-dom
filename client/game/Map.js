// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { GameConstants } from "./constant.js";
import { SeededRandom } from "./seededRandom.js";

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - MAP GENERATION SYSTEM)
// =============================================================================
export class BombermanMapGenerator {
    // =============================================================================
    // STEP 3: CONSTRUCTOR (EXECUTED THIRD - GENERATOR INITIALIZATION)
    // =============================================================================
    constructor(seed, width, height, density, powerupChance) {
        // Store map generation parameters
        this.seed = seed;                                    // Seed for reproducible random generation
        this.width = width;                                  // Map width in cells
        this.height = height;                                // Map height in cells
        this.density = density / 100;                        // Convert density percentage to decimal
        this.powerupChance = powerupChance / 100;            // Convert powerup chance to decimal
        
        // Initialize seeded random generator for consistent map generation
        this.random = new SeededRandom(seed);
        
        // Initialize data structures
        this.map = [];                                       // 2D array representing the map
        this.hiddenPowerups = new Map();                     // Map of powerup locations
    }

    // =============================================================================
    // STEP 4: MAP GENERATION ORCHESTRATION (EXECUTED ON GENERATE CALL - MAIN PROCESS)
    // =============================================================================
    generate() {
        // Execute map generation steps in sequence
        this.initializeMap();       // Create basic map structure with walls
        this.placePlayerSpawns();   // Mark player starting positions
        this.placePowerups();       // Hide powerups in destructible walls
        
        // Return complete map data
        return { map: this.map, hiddenPowerups: this.hiddenPowerups };
    }

    // =============================================================================
    // STEP 5: MAP STRUCTURE INITIALIZATION (EXECUTED FIRST IN GENERATION - LAYOUT CREATION)
    // =============================================================================
    initializeMap() {
        this.map = [];
        
        // Generate each row and column of the map
        for (let y = 0; y < this.height; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.width; x++) {
                // Create border walls around map edges
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    this.map[y][x] = GameConstants.CELL_TYPES.WALL;
                } 
                // Create grid pattern of indestructible walls
                else if (x % 2 === 0 && y % 2 === 0) {
                    this.map[y][x] = GameConstants.CELL_TYPES.WALL;
                } 
                // Keep spawn areas clear (corners of the map)
                else if ((x <= 2 && y <= 2) || (x >= this.width - 3 && y <= 2) || 
                          (x <= 2 && y >= this.height - 3) || (x >= this.width - 3 && y >= this.height - 3)) {
                    this.map[y][x] = GameConstants.CELL_TYPES.EMPTY;
                } 
                // Randomly place destructible walls based on density setting
                else {
                    this.map[y][x] = this.random.next() < this.density ? 
                        GameConstants.CELL_TYPES.DESTRUCTIBLE : GameConstants.CELL_TYPES.EMPTY;
                }
            }
        }
    }

    // =============================================================================
    // STEP 6: PLAYER SPAWN PLACEMENT (EXECUTED SECOND IN GENERATION - STARTING POSITIONS)
    // =============================================================================
    placePlayerSpawns() {
        // Define spawn positions at the four corners (offset from walls)
        const spawns = [
            [1, 1],                           // Top-left
            [this.width - 2, 1],             // Top-right
            [1, this.height - 2],            // Bottom-left
            [this.width - 2, this.height - 2] // Bottom-right
        ];
        
        // Mark each valid spawn position on the map
        spawns.forEach(([x, y]) => {
            if (this.isValidPosition(x, y)) {
                this.map[y][x] = GameConstants.CELL_TYPES.PLAYER_SPAWN;
            }
        });
    }

    // =============================================================================
    // STEP 7: POWERUP PLACEMENT (EXECUTED THIRD IN GENERATION - HIDDEN REWARDS)
    // =============================================================================
    placePowerups() {
        // Define available powerup types
        const powerupTypes = [
            GameConstants.CELL_TYPES.BOMB_POWERUP,    // Increases bomb capacity
            GameConstants.CELL_TYPES.FLAME_POWERUP,   // Increases explosion range
            GameConstants.CELL_TYPES.SPEED_POWERUP    // Increases movement speed
        ];
        
        // Clear any existing hidden powerups
        this.hiddenPowerups.clear();

        // Scan entire map for destructible wall positions
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Check if destructible wall should contain a powerup
                if (this.map[y][x] === GameConstants.CELL_TYPES.DESTRUCTIBLE && 
                    this.random.chance(this.powerupChance)) {
                    
                    // Randomly select powerup type and store location
                    const powerupType = powerupTypes[this.random.nextInt(0, powerupTypes.length - 1)];
                    this.hiddenPowerups.set(`${x},${y}`, powerupType);
                }
            }
        }
    }

    // =============================================================================
    // STEP 8: VALIDATION UTILITY (EXECUTED ON DEMAND - POSITION CHECKING)
    // =============================================================================
    isValidPosition(x, y) {
        // Check if coordinates are within map boundaries
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}