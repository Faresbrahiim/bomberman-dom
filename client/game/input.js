// =============================================================================
// STEP 1: CLASS DEFINITION (EXECUTED FIRST - INPUT MANAGEMENT SYSTEM)
// =============================================================================
export class InputHandler {
    // =============================================================================
    // STEP 2: CONSTRUCTOR (EXECUTED SECOND - INPUT SYSTEM INITIALIZATION)
    // =============================================================================
    constructor() {
        // Initialize input tracking state
        this.keysPressed = {};      // Track which keys are currently pressed
        this.disabled = false;      // Global input disable flag
        
        // Setup keyboard event listeners
        this.setupEventListeners();
    }
    
    // =============================================================================
    // STEP 3: EVENT LISTENER SETUP (EXECUTED THIRD - KEYBOARD EVENT BINDING)
    // =============================================================================
    setupEventListeners() {
        // Handle keydown events for key press detection
        document.addEventListener('keydown', (e) => {
            // Ignore keys if typing in chat or input is disabled
            if (this.disabled || document.activeElement.matches("input, textarea")) return;

            // Convert key to lowercase for consistent comparison
            const key = e.key.toLowerCase();
            this.keysPressed[key] = true;

            // Prevent default browser behavior for game control keys
            if (
                key === ' ' || key === 'spacebar' || key === 'enter' ||
                ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
            ) {
                e.preventDefault();
            }
        });

        // Handle keyup events for key release detection
        document.addEventListener('keyup', (e) => {
            // Ignore keys if typing in chat or input is disabled
            if (this.disabled || document.activeElement.matches("input, textarea")) return;
            
            // Mark key as not pressed
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }

    // =============================================================================
    // STEP 4: MOVEMENT INPUT PROCESSING (EXECUTED ON GAME LOOP - DIRECTION CALCULATION)
    // =============================================================================
    getMovementInput() {
        // Return no movement if input is disabled
        if (this.disabled) return { dx: 0, dy: 0 };

        // Initialize movement deltas
        let dx = 0;
        let dy = 0;

        // Check movement keys and calculate direction vectors
        if (this.keysPressed['w'] || this.keysPressed['arrowup']) dy -= 1;
        if (this.keysPressed['s'] || this.keysPressed['arrowdown']) dy += 1;
        if (this.keysPressed['a'] || this.keysPressed['arrowleft']) dx -= 1;
        if (this.keysPressed['d'] || this.keysPressed['arrowright']) dx += 1;

        return { dx, dy };
    }

    // =============================================================================
    // STEP 5: BOMB INPUT DETECTION (EXECUTED ON GAME LOOP - ACTION KEY CHECKING)
    // =============================================================================
    isBombKeyPressed() {
        // Return false if input is disabled
        if (this.disabled) return false;
        
        // Check if spacebar (bomb placement key) is pressed
        return this.keysPressed[' '];
    }

    // =============================================================================
    // STEP 6: RESET INPUT DETECTION (EXECUTED ON GAME LOOP - RESET KEY CHECKING)
    // =============================================================================
    isResetKeyPressed() {
        // Return false if input is disabled
        if (this.disabled) return false;
        
        // Check if Enter key (reset key) is pressed
        return this.keysPressed['enter'];
    }

    // =============================================================================
    // STEP 7: INPUT CONTROL METHODS (EXECUTED ON DEMAND - STATE MANAGEMENT)
    // =============================================================================
    enable() {
        // Enable input processing
        this.disabled = false;
    }

    disable() {
        // Disable input processing and clear all pressed keys
        this.disabled = true;
        this.keysPressed = {};
    }
}