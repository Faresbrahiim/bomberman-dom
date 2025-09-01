import { GameConstants } from "./constant.js";
import { VNode } from "../framework/vdom.js";

export class GameUI {
    constructor() {
        this.injectPlayerCardStyles();
    }

    injectPlayerCardStyles() {
        // Prevent duplicate style injection
        if (this.playerCardStyleInjected) return;
        const styleVNode = new VNode("style", { id: "player-card-styles" }, []);
        document.head.appendChild(styleVNode.render());
        this.playerCardStyleInjected = true;
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
        playerAvatar.className = `player-avatar player-${playerId}`;
        playerAvatar.textContent = `P${playerId}`;

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