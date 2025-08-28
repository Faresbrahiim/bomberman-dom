import { GameConstants } from "./constant.js";

export class GameUI {
    updateAllPlayersStatus(players) {
        const statusArea = document.getElementById('playerStatusArea');
        if (!statusArea) return;
    
        statusArea.innerHTML = '<h3>Players:</h3>';
    
        const playersContainer = document.createElement('div');
        playersContainer.style.display = 'grid';
        // Each player gets a fixed width of 200px, like your map tiles are fixed 60px
        playersContainer.style.gridTemplateColumns = `repeat(${players.length}, 200px)`;
        playersContainer.style.gap = '10px';
    
        players.forEach((player, playerId) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-status ${player.isLocal ? 'local-player-status' : 'remote-player-status'}`;
            playerDiv.style.width = '60';
            playerDiv.style.height = '60';
            playerDiv.style.backgroundSize = 'cover';
            playerDiv.style.zIndex = '10';
            playerDiv.style.backgroundColor = player.isLocal ? '#e8f5e8' : '#f5f5f5';
            playerDiv.innerHTML = `
                <div style="font-weight: bold; color: ${this.getPlayerColor(playerId)};">
                    ${player.nickname} ${player.isLocal ? '(You)' : ''}
                </div>
                <div>Lives: ${player.lives}</div>
                <div>Bombs: ${player.powerups.bombs}</div>
                <div>Flames: ${player.powerups.flames}</div>
                <div>Speed: ${player.powerups.speed}</div>
            `;
    
            playersContainer.appendChild(playerDiv);
        });
    
        statusArea.appendChild(playersContainer);
    }
    

    getPlayerColor(playerId) {
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
        return colors[playerId - 1] || '#ff4444';
    }

    renderMap(map, width, height, hiddenPowerups) {
        // First, find or create the map container
        let mapElement = document.getElementById('map');
        if (!mapElement) {
            // Create map container if it doesn't exist
            const gameContainer = document.getElementById('gameMapContainer');
            if (!gameContainer) {
                console.error('Game container not found!');
                return;
            }
            
            mapElement = document.createElement('div');
            mapElement.id = 'map';
            mapElement.style.display = 'grid';
            mapElement.style.gridTemplateColumns = `repeat(${width}, ${GameConstants.TILE_SIZE}px)`;
            mapElement.style.gridTemplateRows = `repeat(${height}, ${GameConstants.TILE_SIZE}px)`;
            mapElement.style.gap = '0';
            mapElement.style.position = 'relative';
            gameContainer.appendChild(mapElement);
        }

        mapElement.innerHTML = '';

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.style.width = GameConstants.TILE_SIZE + 'px';
                cell.style.height = GameConstants.TILE_SIZE + 'px';

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
