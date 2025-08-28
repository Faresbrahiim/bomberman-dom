

export class InputHandler {
    constructor() {
        this.keysPressed = {};
        this.setupEventListeners();
    }
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Ignore keys if typing in chat
            if (document.activeElement.matches("input, textarea")) return;

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
            if (document.activeElement.matches("input, textarea")) return;
            this.keysPressed[e.key.toLowerCase()] = false;
        });
    }



    getMovementInput() {
        let dx = 0;
        let dy = 0;

        if (this.keysPressed['w'] || this.keysPressed['arrowup']) dy -= 1;
        if (this.keysPressed['s'] || this.keysPressed['arrowdown']) dy += 1;
        if (this.keysPressed['a'] || this.keysPressed['arrowleft']) dx -= 1;
        if (this.keysPressed['d'] || this.keysPressed['arrowright']) dx += 1;

        return { dx, dy };
    }

    isBombKeyPressed() {
        return this.keysPressed[' '];
    }

    isResetKeyPressed() {
        return this.keysPressed['enter'];
    }
}