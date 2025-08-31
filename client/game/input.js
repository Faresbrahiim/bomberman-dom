export class InputHandler {
  constructor(eventRegistry, vdomManager = null) {
    this.eventRegistry = eventRegistry;
    this.vdomManager = vdomManager;
    this.keysPressed = {};
    this.disabled = false;
    this.unsubscribeFns = [];
    this.gameInputRefKey = "game-keyboard-input"; // Reference key for game input
    this.setupEventListeners();
  }

  setVDOMManager(vdomManager) {
    this.vdomManager = vdomManager;
  }

  setupEventListeners() {
    const unsubDown = this.eventRegistry.subscribe("keydown", (e) => {
      if (this.disabled) return;
      
      // Check if focus is on a game input element or other input/textarea
      if (document.activeElement && this.shouldIgnoreKeyEvent(document.activeElement)) {
        return;
      }
      
      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;
      
      // Prevent default for game control keys
      if (this.isGameControlKey(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    const unsubUp = this.eventRegistry.subscribe("keyup", (e) => {
      if (this.disabled) return;
      
      if (document.activeElement && this.shouldIgnoreKeyEvent(document.activeElement)) {
        return;
      }
      
      const key = e.key.toLowerCase();
      this.keysPressed[key] = false;
    });

    this.unsubscribeFns.push(unsubDown, unsubUp);
  }

  shouldIgnoreKeyEvent(activeElement) {
    // If we have a VDOM manager, check against registered refs
    if (this.vdomManager) {
      const gameInputElement = this.vdomManager.getRef(this.gameInputRefKey);
      if (activeElement !== gameInputElement && activeElement.matches("input, textarea")) {
        return true;
      }
    } else {
      // Fallback: check if it's any input/textarea that's not specifically for game input
      if (activeElement.matches("input, textarea") && 
          !activeElement.dataset?.gameInput) {
        return true;
      }
    }
    return false;
  }

  isGameControlKey(key) {
    return [
      " ", "spacebar", "enter",
      "w", "a", "s", "d",
      "arrowup", "arrowdown", "arrowleft", "arrowright"
    ].includes(key);
  }

  getMovementInput() {
    if (this.disabled) return { dx: 0, dy: 0 };
    
    let dx = 0, dy = 0;
    
    if (this.keysPressed["w"] || this.keysPressed["arrowup"]) dy -= 1;
    if (this.keysPressed["s"] || this.keysPressed["arrowdown"]) dy += 1;
    if (this.keysPressed["a"] || this.keysPressed["arrowleft"]) dx -= 1;
    if (this.keysPressed["d"] || this.keysPressed["arrowright"]) dx += 1;
    
    return { dx, dy };
  }

  isBombKeyPressed() {
    if (this.disabled) return false;
    return this.keysPressed[" "] || this.keysPressed["spacebar"];
  }

  isResetKeyPressed() {
    if (this.disabled) return false;
    return this.keysPressed["enter"];
  }

  // Check if a specific key is pressed
  isKeyPressed(key) {
    if (this.disabled) return false;
    return this.keysPressed[key.toLowerCase()];
  }

  // Get the game input element through the framework
  getGameInputElement() {
    if (this.vdomManager) {
      return this.vdomManager.getRef(this.gameInputRefKey);
    }
    return null;
  }

  // Focus the game input element
  focusGameInput() {
    const gameInput = this.getGameInputElement();
    if (gameInput) {
      gameInput.focus();
    }
  }

  enable() { 
    this.disabled = false;
  }

  disable() { 
    this.disabled = true; 
    this.keysPressed = {};
  }

  destroy() { 
    this.unsubscribeFns.forEach(fn => fn && fn()); 
    this.unsubscribeFns = []; 
    this.keysPressed = {};
  }
}