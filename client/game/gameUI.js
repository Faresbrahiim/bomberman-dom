import { GameConstants } from "./constant.js";

export class GameUI {
    constructor() {
        this.injectPlayerCardStyles();
    }

    injectPlayerCardStyles() {
        // Check if styles are already injected
        if (document.getElementById('player-card-styles')) return;

        const style = document.createElement('style');
        style.id = 'player-card-styles';
        style.textContent = `
            #playerStatusArea {
                background-color: #fafafa;
                background-image: radial-gradient(
                    circle 6px,
                    rgba(84, 245, 255, 0.35) 60%,   /* lighter, semi-transparent */
                    transparent 100%
                  ),
                  radial-gradient(
                    circle 6px,
                    rgba(84, 245, 255, 0.35) 60%,
                    transparent 100%
                  );
                background-position: 0 0, 16px 16px;
                background-size: 32px 32px;
                overflow: hidden;
                padding: 10px;
            }

            .players-container {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                justify-content: center;
                padding: 20px;
                background: transparent;
            }

            .player-card {
                background: linear-gradient(145deg, #2c3e50, #34495e);
                border: 3px solid #f39c12;
                border-radius: 15px;
                padding: 15px;
                width: 200px;
                position: relative;
                transition: all 0.3s ease;
                overflow: hidden;
            }


            .player-card.local-player {
                border-color: #27ae60;
                background: linear-gradient(145deg, #2d5a3d, #34634a);
            }

            .player-card.eliminated {
                opacity: 0.6;
                filter: grayscale(50%);
                border-color: #e74c3c;
            }

            .player-header {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                position: relative;
            }

            .player-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                margin-right: 10px;
                border: 2px solid #f39c12;
                background: radial-gradient(circle, #ff6b6b, #ee5a52);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: bold;
                color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            }

            .player-avatar.player-1 { background: radial-gradient(circle, #ff6b6b, #ee5a52); }
            .player-avatar.player-2 { background: radial-gradient(circle, #4ecdc4, #44a08d); }
            .player-avatar.player-3 { background: radial-gradient(circle, #45b7d1, #2980b9); }
            .player-avatar.player-4 { background: radial-gradient(circle, #f9ca24, #f0932b); }

            .player-name {
                color: #ecf0f1;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                flex-grow: 1;
            }

            .local-badge {
                background: linear-gradient(45deg, #27ae60, #2ecc71);
                color: white;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .stats-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }

            .stat-item {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border: 1px solid rgba(255,255,255,0.1);
            }

            .stat-icon {
                font-size: 16px;
                margin-right: 6px;
            }

            .stat-label {
                color: #bdc3c7;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .stat-value {
                color: #ecf0f1;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            }

            .lives-container {
                grid-column: 1 / -1;
                background: rgba(231, 76, 60, 0.2);
                border: 1px solid rgba(231, 76, 60, 0.3);
            }

            .lives-hearts {
                display: flex;
                gap: 3px;
                align-items: center;
            }

            .heart {
                color: #e74c3c;
                font-size: 16px;
                filter: drop-shadow(0 0 3px rgba(231, 76, 60, 0.8));
            }

            .heart.empty {
                color: #555;
                filter: none;
            }

            .powerup-bombs { border-left: 3px solid #f39c12; }
            .powerup-flames { border-left: 3px solid #e74c3c; }
            .powerup-speed { border-left: 3px solid #3498db; }

            .glow-effect {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(45deg, transparent, rgba(243, 156, 18, 0.3), transparent);
                border-radius: 17px;
                z-index: -1;
                animation: glow-pulse 2s ease-in-out infinite alternate;
            }

            .local-player .glow-effect {
                background: linear-gradient(45deg, transparent, rgba(39, 174, 96, 0.3), transparent);
            }

            @keyframes glow-pulse {
                0% { opacity: 0.5; transform: scale(1); }
                100% { opacity: 1; transform: scale(1.02); }
            }

            .eliminated-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-15deg);
                background: rgba(231, 76, 60, 0.9);
                color: white;
                padding: 5px 15px;
                border-radius: 5px;
                font-weight: bold;
                font-size: 12px;
                text-transform: uppercase;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
    }

    updateAllPlayersStatus(players) {
        const statusArea = document.getElementById('playerStatusArea');
        if (!statusArea) return;

        // Clear existing content
        statusArea.innerHTML = '';

        // Create players container
        const playersContainer = document.createElement('div');
        playersContainer.className = 'players-container';

        players.forEach((player, playerId) => {
            const playerCard = this.createPlayerCard(player, playerId);
            playersContainer.appendChild(playerCard);
        });

        statusArea.appendChild(playersContainer);
    }

    createPlayerCard(player, playerId) {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.isLocal ? 'local-player' : ''}`;
        
        // Add eliminated class if player has no lives
        if (player.lives <= 0) {
            playerCard.classList.add('eliminated');
        }

        // Create glow effect
        const glowEffect = document.createElement('div');
        glowEffect.className = 'glow-effect';
        playerCard.appendChild(glowEffect);

        // Create eliminated overlay if needed
        if (player.lives <= 0) {
            const eliminatedOverlay = document.createElement('div');
            eliminatedOverlay.className = 'eliminated-overlay';
            eliminatedOverlay.textContent = 'Eliminated';
            playerCard.appendChild(eliminatedOverlay);
        }

        // Create player header
        const playerHeader = document.createElement('div');
        playerHeader.className = 'player-header';

        const playerAvatar = document.createElement('div');
        playerAvatar.className = `player-avatar player-${playerId }`;
        playerAvatar.textContent = `P${playerId }`;

        const playerName = document.createElement('div');
        playerName.className = 'player-name';
        playerName.textContent = player.nickname || `Player ${playerId}`;

        playerHeader.appendChild(playerAvatar);
        playerHeader.appendChild(playerName);

        if (player.isLocal) {
            const localBadge = document.createElement('div');
            localBadge.className = 'local-badge';
            localBadge.textContent = 'You';
            playerHeader.appendChild(localBadge);
        }

        // Create stats container
        const statsContainer = document.createElement('div');
        statsContainer.className = 'stats-container';

        // Lives stat (full width)
        const livesContainer = document.createElement('div');
        livesContainer.className = 'stat-item lives-container';
        
        const livesLabel = document.createElement('div');
        const livesIcon = document.createElement('span');
        livesIcon.className = 'stat-icon';
        livesIcon.textContent = '❤️';
        const livesLabelText = document.createElement('span');
        livesLabelText.className = 'stat-label';
        livesLabelText.textContent = 'Lives';
        livesLabel.appendChild(livesIcon);
        livesLabel.appendChild(livesLabelText);

        const livesHearts = document.createElement('div');
        livesHearts.className = 'lives-hearts';
        
        // Assuming max 3 lives, adjust as needed
        const maxLives = Math.max(3, player.lives);
        for (let i = 0; i < maxLives; i++) {
            const heart = document.createElement('span');
            heart.className = i < player.lives ? 'heart' : 'heart empty';
            heart.textContent = '♥';
            livesHearts.appendChild(heart);
        }

        livesContainer.appendChild(livesLabel);
        livesContainer.appendChild(livesHearts);

        // Bombs stat
        const bombsContainer = this.createStatItem('💣', 'Bombs', player.powerups.bombs, 'powerup-bombs');
        
        // Flames stat
        const flamesContainer = this.createStatItem('🔥', 'Flames', player.powerups.flames, 'powerup-flames');
        
        // Speed stat
        const speedContainer = this.createStatItem('⚡', 'Speed', player.powerups.speed, 'powerup-speed');

        statsContainer.appendChild(livesContainer);
        statsContainer.appendChild(bombsContainer);
        statsContainer.appendChild(flamesContainer);
        statsContainer.appendChild(speedContainer);

        playerCard.appendChild(playerHeader);
        playerCard.appendChild(statsContainer);

        return playerCard;
    }

    createStatItem(icon, label, value, additionalClass = '') {
        const statItem = document.createElement('div');
        statItem.className = `stat-item ${additionalClass}`;

        const statLabel = document.createElement('div');
        const statIcon = document.createElement('span');
        statIcon.className = 'stat-icon';
        statIcon.textContent = icon;
        const statLabelText = document.createElement('span');
        statLabelText.className = 'stat-label';
        statLabelText.textContent = label;
        statLabel.appendChild(statIcon);
        statLabel.appendChild(statLabelText);

        const statValue = document.createElement('span');
        statValue.className = 'stat-value';
        statValue.textContent = value;

        statItem.appendChild(statLabel);
        statItem.appendChild(statValue);

        return statItem;
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