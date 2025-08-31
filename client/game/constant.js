export class GameConstants {
    static CELL_TYPES = {
        EMPTY: 0,
        WALL: 1,
        DESTRUCTIBLE: 2,
        PLAYER_SPAWN: 3,
        BOMB_POWERUP: 4,
        FLAME_POWERUP: 5,
        SPEED_POWERUP: 6,
        BOMB: 7
    };

    static TILE_SIZE = 60;
    static BASE_PLAYER_SPEED = 2;
    static COLLISION_GRACE = 1.5;
    static CORNER_HELP_RANGE = 29;
    static BOMB_TIMER = 3000;
    static FLAME_DURATION = 500;
    static INVINCIBILITY_DURATION = 2000;
    static FRAME_SPEED = 6;
    static FRAMES_PER_ROW = 4;
}