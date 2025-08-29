export class InputHandler {
    constructor() {
        this.keysPressed = {};
        this.disabled = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Ignore keys if typing in chat or input is disabled
            if (this.disabled || document.activeElement.matches("input, textarea")) return;

            const key = e.key.toLowerCase();
            this.keysPressed[key] = true;

            if (
                key === ' ' || key === 'spacebar' || key === 'enter' ||
                ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
            ) {
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (this.disabled || document.activeElement.matches("input, textarea")) return;
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }

    getMovementInput() {
        if (this.disabled) return { dx: 0, dy: 0 };

        let dx = 0;
        let dy = 0;

        if (this.keysPressed['w'] || this.keysPressed['arrowup']) dy -= 1;
        if (this.keysPressed['s'] || this.keysPressed['arrowdown']) dy += 1;
        if (this.keysPressed['a'] || this.keysPressed['arrowleft']) dx -= 1;
        if (this.keysPressed['d'] || this.keysPressed['arrowright']) dx += 1;

        return { dx, dy };
    }

    isBombKeyPressed() {
        if (this.disabled) return false;
        return this.keysPressed[' '];
    }

    isResetKeyPressed() {
        if (this.disabled) return false;
        return this.keysPressed['enter'];
    }

    enable() {
        this.disabled = false;
    }

    disable() {
        this.disabled = true;
        this.keysPressed = {};
    }
}