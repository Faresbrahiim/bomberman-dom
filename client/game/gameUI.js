import { GameConstants } from "./constant.js";
export class GameUI {
    updatePlayerStatus(powerups) {
        document.getElementById('bomb-count').textContent = powerups.bombs;
        document.getElementById('flame-count').textContent = powerups.flames;
        document.getElementById('speed-count').textContent = powerups.speed;
        document.getElementById('health-count').textContent = powerups.health;
    }

    renderMap(map, width, height, hiddenPowerups) {
        const mapElement = document.getElementById('map');
        mapElement.innerHTML = '';

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                switch (map[y][x]) {
                    case GameConstants.CELL_TYPES.EMPTY:
                        cell.classList.add('empty');
                        break;
                    case GameConstants.CELL_TYPES.WALL:
                        cell.classList.add('wall');
                        break;
                    case GameConstants.CELL_TYPES.DESTRUCTIBLE:
                        cell.classList.add('destructible');
                        if (hiddenPowerups.has(`${x},${y}`)) {
                            cell.classList.add('has-powerup');
                        }
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
                    case GameConstants.CELL_TYPES.BOMB:
                        cell.classList.add('bomb');
                        break;
                }
                mapElement.appendChild(cell);
            }
        }
    }
}
