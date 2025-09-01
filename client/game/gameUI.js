// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { GameConstants } from "./constant.js";
import { VNode } from "../framework/vdom.js";
import { VDOMManager } from '../framework/VDOMmanager.js';

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - UI MANAGEMENT SYSTEM)
// =============================================================================
export class GameUI {
    // =============================================================================
    // STEP 3: CONSTRUCTOR (EXECUTED THIRD - UI CONTAINER INITIALIZATION)
    // =============================================================================
    constructor(statusContainer, mapContainer) {
        // Store references to DOM containers for player status and game map
        this.statusContainer = statusContainer;
        this.mapContainer = mapContainer;
    }

    // =============================================================================
    // STEP 4: PLAYER STATUS UPDATE (EXECUTED ON GAME STATE CHANGES - UI SYNCHRONIZATION)
    // =============================================================================
    updateAllPlayersStatus(players) {
        // Validate status container exists
        if (!this.statusContainer) {
            console.error('statusContainer not provided!');
            return;
        }

        // Initialize VDOM manager for player status if not exists
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

        // Update VDOM state to trigger re-render
        this.playerStatusManager.setState({ players });
    }

    // =============================================================================
    // STEP 5: PLAYER STATUS RENDERING (EXECUTED ON STATE UPDATES - PLAYER CARDS GENERATION)
    // =============================================================================
    renderPlayersStatus(players) {
        console.log('Rendering players status:', players);

        const playerCards = [];

        // Handle different data structure types for player collection
        if (players instanceof Map) {
            // Handle Map structure
            players.forEach((player, playerId) => {
                console.log(`Player ${playerId}:`, player);
                playerCards.push(this.createPlayerCard(player, playerId));
            });
        } else if (Array.isArray(players)) {
            // Handle Array structure
            players.forEach((player, index) => {
                console.log(`Player ${index}:`, player);
                playerCards.push(this.createPlayerCard(player, index));
            });
        } else if (players && typeof players === 'object') {
            // Handle plain object structure
            Object.entries(players).forEach(([playerId, player]) => {
                console.log(`Player ${playerId}:`, player);
                playerCards.push(this.createPlayerCard(player, parseInt(playerId)));
            });
        }

        // Return container VNode with all player cards
        return new VNode('div', { class: 'players-container' }, playerCards);
    }

    // =============================================================================
    // STEP 6: PLAYER CARD CREATION (EXECUTED PER PLAYER - INDIVIDUAL UI COMPONENTS)
    // =============================================================================
    createPlayerCard(player, playerId) {
        console.log('Creating card for player:', playerId, player);

        // Validate player data exists
        if (!player) {
            console.warn(`Player ${playerId} is null or undefined`);
            return new VNode('div', { class: 'player-card error' }, ['Invalid player data']);
        }

        // Provide default values for missing properties to prevent errors
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

        // Helper function to create lives hearts visual representation
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

        // Build CSS class names based on player state
        const cardClasses = [
            'player-card',
            safePlayer.isLocal ? 'local-player' : '',
            safePlayer.lives <= 0 ? 'eliminated' : ''
        ].filter(Boolean).join(' ');

        // Build child elements array for player card structure
        const children = [
            // Glow effect for visual enhancement
            new VNode('div', { class: 'glow-effect' }),

            // Eliminated overlay (conditional rendering)
            ...(safePlayer.lives <= 0 ? [
                new VNode('div', { class: 'eliminated-overlay' }, ['Eliminated'])
            ] : []),

            // Player header with avatar and name
            new VNode('div', { class: 'player-header' }, [
                new VNode('div', {
                    class: `player-avatar player-${playerId}`
                }, [`P${playerId}`]),

                new VNode('div', { class: 'player-name' }, [
                    safePlayer.nickname
                ]),

                // Local badge (conditional rendering for current player)
                ...(safePlayer.isLocal ? [
                    new VNode('div', { class: 'local-badge' }, ['You'])
                ] : [])
            ]),

            // Stats container with lives and powerups
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

                // Powerup stats using the refactored createStatItem method
                this.createStatItem('💣', 'Bombs', safePlayer.powerups.bombs, 'powerup-bombs'),
                this.createStatItem('🔥', 'Flames', safePlayer.powerups.flames, 'powerup-flames'),
                this.createStatItem('⚡', 'Speed', safePlayer.powerups.speed, 'powerup-speed')
            ])
        ];

        return new VNode('div', { class: cardClasses }, children);
    }

    // =============================================================================
    // STEP 7: STAT ITEM CREATION (EXECUTED PER STAT - POWERUP DISPLAY COMPONENTS)
    // =============================================================================
    createStatItem(icon, label, value, additionalClass = '') {
        // Ensure value is a number and provide fallback for safety
        const displayValue = value !== undefined && value !== null ? value : 0;

        console.log(`Creating stat item: ${label} = ${displayValue} (type: ${typeof displayValue})`);

        // Return stat item VNode with icon, label, and value
        return new VNode('div', { class: `stat-item ${additionalClass}` }, [
            new VNode('div', {}, [
                new VNode('span', { class: 'stat-icon' }, [icon]),
                new VNode('span', { class: 'stat-label' }, [label])
            ]),
            new VNode('span', { class: 'stat-value' }, [String(displayValue)])
        ]);
    }

    // =============================================================================
    // STEP 8: PLAYER COLOR MAPPING (EXECUTED ON DEMAND - VISUAL IDENTIFICATION)
    // =============================================================================
    getPlayerColor(playerId) {
        // Map player IDs to distinct colors for visual differentiation
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
        return colors[playerId] || '#ff4444';
    }

    // =============================================================================
    // STEP 9: MAP RENDERING SYSTEM (EXECUTED ON MAP UPDATES - GAME WORLD DISPLAY)
    // =============================================================================
    renderMap(map, width, height, hiddenPowerups) {
        // Validate map container exists
        if (!this.mapContainer) {
            console.error('mapContainer not provided!');
            return;
        }

        // Initialize VDOM manager for the map if not exists
        if (!this.mapManager) {
            this.mapManager = new VDOMManager(
                this.mapContainer,
                (state) => this.renderMapVNode(state.map, state.width, state.height, state.hiddenPowerups),
                { map: [], width: 0, height: 0, hiddenPowerups: new Set() }
            );
            this.mapManager.mount();
        }

        // Update VDOM state to trigger map re-render
        this.mapManager.setState({ map, width, height, hiddenPowerups });
    }

    // =============================================================================
    // STEP 10: MAP VNODE GENERATION (EXECUTED ON MAP STATE CHANGES - GRID CELL RENDERING)
    // =============================================================================
    renderMapVNode(map, width, height, hiddenPowerups) {
        const cells = [];

        // Generate VNode for each cell in the 2D map grid
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cellType = map[y][x];
                const cellClasses = ['cell'];

                // Apply CSS classes based on cell type for visual styling
                switch (cellType) {
                    case GameConstants.CELL_TYPES.EMPTY:
                        cellClasses.push('empty');
                        break;
                    case GameConstants.CELL_TYPES.WALL:
                        cellClasses.push('wall');
                        break;
                    case GameConstants.CELL_TYPES.DESTRUCTIBLE:
                        cellClasses.push('destructible');
                        // Add powerup hint class if hidden powerup exists at this position
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

                // Create cell VNode with proper attributes for positioning and styling
                const cellVNode = new VNode('div', {
                    class: cellClasses.join(' '),
                    'data-x': x,
                    'data-y': y,
                    style: `width: ${GameConstants.TILE_SIZE}px; height: ${GameConstants.TILE_SIZE}px;`,
                    key: `cell-${x}-${y}` // Important for efficient VDOM diffing
                });

                cells.push(cellVNode);
            }
        }

        // Return the complete map container VNode with CSS Grid layout
        return new VNode('div', {
            id: 'map',
            style: `display: grid; grid-template-columns: repeat(${width}, ${GameConstants.TILE_SIZE}px); grid-template-rows: repeat(${height}, ${GameConstants.TILE_SIZE}px); gap: 0; position: relative;`
        }, cells);
    }
}