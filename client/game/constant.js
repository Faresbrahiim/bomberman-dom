// =============================================================================
// STEP 1: CLASS DEFINITION (EXECUTED FIRST - GAME CONFIGURATION CONSTANTS)
// =============================================================================
export class GameConstants {
    // =============================================================================
    // STEP 2: CELL TYPE DEFINITIONS (EXECUTED SECOND - MAP ELEMENT IDENTIFIERS)
    // =============================================================================
    static CELL_TYPES = {
        EMPTY: 0,           // Empty walkable space
        WALL: 1,            // Indestructible wall boundaries
        DESTRUCTIBLE: 2,    // Breakable walls that can hide powerups
        PLAYER_SPAWN: 3,    // Player starting positions
        BOMB_POWERUP: 4,    // Increases maximum bomb count
        FLAME_POWERUP: 5,   // Increases bomb explosion range
        SPEED_POWERUP: 6,   // Increases player movement speed
        BOMB: 7             // Active bomb placement marker
    };

    // =============================================================================
    // STEP 3: VISUAL CONSTANTS (EXECUTED THIRD - RENDERING SPECIFICATIONS)
    // =============================================================================
    static TILE_SIZE = 60;                  // Pixel size for each grid cell
    static FRAME_SPEED = 6;                 // Animation frame advance rate
    static FRAMES_PER_ROW = 4;              // Sprite sheet frame organization

    // =============================================================================
    // STEP 4: MOVEMENT CONSTANTS (EXECUTED FOURTH - PLAYER PHYSICS)
    // =============================================================================
    static BASE_PLAYER_SPEED = 2;           // Base movement pixels per frame
    static COLLISION_GRACE = 1.5;           // Collision detection tolerance
    static CORNER_HELP_RANGE = 29;          // Corner assistance detection range

    // =============================================================================
    // STEP 5: GAMEPLAY TIMING (EXECUTED FIFTH - GAME MECHANICS DURATIONS)
    // =============================================================================
    static BOMB_TIMER = 3000;               // Bomb explosion delay in milliseconds
    static FLAME_DURATION = 500;            // Explosion flame display time
    static INVINCIBILITY_DURATION = 2000;   // Player damage immunity period
}