import { GameConstants } from "./constant.js";
import { VNode } from "../framework/vdom.js";
import { VDOMManager } from '../framework/VDOMmanager.js';

export class GameUI {
    constructor(statusContainer, mapContainer) {
        this.statusContainer = statusContainer;
        this.mapContainer = mapContainer;
    }

    updateAllPlayersStatus(players) {
        if (!this.statusContainer) {
            console.error('statusContainer not provided!');
            return;
        }

        // Initialize VDOMManager if not exists
        if (!this.playerStatusManager) {
            this.playerStatusManager = new VDOMManager(
                this.statusContainer,
                (state) => this.renderPlayersStatus(state.players),
                { players: [] }
            );
            this.playerStatusManager.mount();
        }

        // Debug: Log the players data to see what's being passed
        console.log('Updating players status:', players);

        // Update state to trigger re-render
        this.playerStatusManager.setState({ players });
    }

    // Render function for the players status
    renderPlayersStatus(players) {
        console.log('Rendering players status:', players);

        const playerCards = [];

        // Handle both Map and Array cases
        if (players instanceof Map) {
            players.forEach((player, playerId) => {
                console.log(`Player ${playerId}:`, player);
                playerCards.push(this.createPlayerCard(player, playerId));
            });
        } else if (Array.isArray(players)) {
            players.forEach((player, index) => {
                console.log(`Player ${index}:`, player);
                playerCards.push(this.createPlayerCard(player, index));
            });
        } else if (players && typeof players === 'object') {
            // Handle plain object case
            Object.entries(players).forEach(([playerId, player]) => {
                console.log(`Player ${playerId}:`, player);
                playerCards.push(this.createPlayerCard(player, parseInt(playerId)));
            });
        }

        return new VNode('div', { class: 'players-container' }, playerCards);
    }

    createPlayerCard(player, playerId) {
        console.log('Creating card for player:', playerId, player);

        // Ensure player object has expected structure
        if (!player) {
            console.warn(`Player ${playerId} is null or undefined`);
            return new VNode('div', { class: 'player-card error' }, ['Invalid player data']);
        }

        // Provide default values for missing properties
        const safePlayer = {
            isLocal: player.isLocal || false,
            lives: player.lives !== undefined ? player.lives : 3,
            nickname: player.nickname || `Player ${playerId}`,
            powerups: {
                bombs: 0,
                flames: 1,
                speed: 1,
                ...player.powerups
            }
        };

        console.log('Safe player data:', safePlayer);
        console.log('Powerups:', safePlayer.powerups);

        // Helper function to create lives hearts
        const createLivesHearts = (currentLives) => {
            const maxLives = Math.max(3, currentLives);
            const hearts = [];

            for (let i = 0; i < maxLives; i++) {
                hearts.push(
                    new VNode('span', {
                        class: i < currentLives ? 'heart' : 'heart empty'
                    }, ['♥'])
                );
            }

            return hearts;
        };

        // Build class names
        const cardClasses = [
            'player-card',
            safePlayer.isLocal ? 'local-player' : '',
            safePlayer.lives <= 0 ? 'eliminated' : ''
        ].filter(Boolean).join(' ');

        // Build child elements array
        const children = [
            // Glow effect
            new VNode('div', { class: 'glow-effect' }),

            // Eliminated overlay (conditional)
            ...(safePlayer.lives <= 0 ? [
                new VNode('div', { class: 'eliminated-overlay' }, ['Eliminated'])
            ] : []),

            // Player header
            new VNode('div', { class: 'player-header' }, [
                new VNode('div', {
                    class: `player-avatar player-${playerId}`
                }, [`P${playerId}`]),

                new VNode('div', { class: 'player-name' }, [
                    safePlayer.nickname
                ]),

                // Local badge (conditional)
                ...(safePlayer.isLocal ? [
                    new VNode('div', { class: 'local-badge' }, ['You'])
                ] : [])
            ]),

            // Stats container
            new VNode('div', { class: 'stats-container' }, [
                // Lives container (spans full width with grid-column: 1 / -1)
                new VNode('div', { class: 'stat-item lives-container' }, [
                    new VNode('div', {}, [
                        new VNode('span', { class: 'stat-icon' }, ['❤️']),
                        new VNode('span', { class: 'stat-label' }, ['Lives'])
                    ]),
                    new VNode('div', { class: 'lives-hearts' },
                        createLivesHearts(safePlayer.lives)
                    )
                ]),

                // Powerup stats using the refactored createStatItem
                this.createStatItem('💣', 'Bombs', safePlayer.powerups.bombs, 'powerup-bombs'),
                this.createStatItem('🔥', 'Flames', safePlayer.powerups.flames, 'powerup-flames'),
                this.createStatItem('⚡', 'Speed', safePlayer.powerups.speed, 'powerup-speed')
            ])
        ];

        return new VNode('div', { class: cardClasses }, children);
    }

    createStatItem(icon, label, value, additionalClass = '') {
        // Ensure value is a number and provide fallback
        const displayValue = value !== undefined && value !== null ? value : 0;

        console.log(`Creating stat item: ${label} = ${displayValue} (type: ${typeof displayValue})`);

        return new VNode('div', { class: `stat-item ${additionalClass}` }, [
            new VNode('div', {}, [
                new VNode('span', { class: 'stat-icon' }, [icon]),
                new VNode('span', { class: 'stat-label' }, [label])
            ]),
            new VNode('span', { class: 'stat-value' }, [String(displayValue)])
        ]);
    }

    getPlayerColor(playerId) {
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
        return colors[playerId] || '#ff4444';
    }

    renderMap(map, width, height, hiddenPowerups) {
        if (!this.mapContainer) {
            console.error('mapContainer not provided!');
            return;
        }

        // Initialize VDOMManager for the map if not exists
        if (!this.mapManager) {
            this.mapManager = new VDOMManager(
                this.mapContainer,
                (state) => this.renderMapVNode(state.map, state.width, state.height, state.hiddenPowerups),
                { map: [], width: 0, height: 0, hiddenPowerups: new Set() }
            );
            this.mapManager.mount();
        }

        // Update state to trigger re-render
        this.mapManager.setState({ map, width, height, hiddenPowerups });
    }

    renderMapVNode(map, width, height, hiddenPowerups) {
        const cells = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cellType = map[y][x];
                const cellClasses = ['cell'];

                // Determine cell type class
                switch (cellType) {
                    case GameConstants.CELL_TYPES.EMPTY:
                        cellClasses.push('empty');
                        break;
                    case GameConstants.CELL_TYPES.WALL:
                        cellClasses.push('wall');
                        break;
                    case GameConstants.CELL_TYPES.DESTRUCTIBLE:
                        cellClasses.push('destructible');
                        if (hiddenPowerups.has(`${x},${y}`)) {
                            cellClasses.push('has-powerup');
                        }
                        break;
                    case GameConstants.CELL_TYPES.PLAYER_SPAWN:
                        cellClasses.push('player-spawn');
                        break;
                    case GameConstants.CELL_TYPES.BOMB_POWERUP:
                        cellClasses.push('bomb-powerup');
                        break;
                    case GameConstants.CELL_TYPES.FLAME_POWERUP:
                        cellClasses.push('flame-powerup');
                        break;
                    case GameConstants.CELL_TYPES.SPEED_POWERUP:
                        cellClasses.push('speed-powerup');
                        break;
                    case GameConstants.CELL_TYPES.BOMB:
                        cellClasses.push('bomb');
                        break;
                }

                // Create cell VNode with proper attributes
                const cellVNode = new VNode('div', {
                    class: cellClasses.join(' '),
                    'data-x': x,
                    'data-y': y,
                    style: `width: ${GameConstants.TILE_SIZE}px; height: ${GameConstants.TILE_SIZE}px;`,
                    key: `cell-${x}-${y}` // Important for efficient diffing
                });

                cells.push(cellVNode);
            }
        }

        // Return the map container VNode
        return new VNode('div', {
            id: 'map',
            style: `display: grid; grid-template-columns: repeat(${width}, ${GameConstants.TILE_SIZE}px); grid-template-rows: repeat(${height}, ${GameConstants.TILE_SIZE}px); gap: 0; position: relative;`
        }, cells);
    }
}