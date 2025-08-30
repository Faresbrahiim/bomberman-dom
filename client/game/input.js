// input.js
import { VNode } from "../framework/vdom.js";

export class InputHandler {
  constructor(eventRegistry) {
    this.eventRegistry = eventRegistry;
    this.keysPressed = {};
    this.disabled = false;
    this.unsubscribeFns = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    const unsubDown = this.eventRegistry.subscribe("keydown", (e) => {
      if (this.disabled) return;
      
      // السماح للإدخال المخفي فقط، مش كل input/textarea
      if (document.activeElement && 
          document.activeElement !== document.getElementById("game-keyboard-input") &&
          document.activeElement.matches("input, textarea")) {
        return;
      }
      
      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;
      
      console.log("مفتاح مضغوط:", key); // للتشخيص
      
      if (
        key === " " || key === "spacebar" || key === "enter" ||
        ["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(key)
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    const unsubUp = this.eventRegistry.subscribe("keyup", (e) => {
      if (this.disabled) return;
      
      if (document.activeElement && 
          document.activeElement !== document.getElementById("game-keyboard-input") &&
          document.activeElement.matches("input, textarea")) {
        return;
      }
      
      const key = e.key.toLowerCase();
      this.keysPressed[key] = false;
      console.log("مفتاح محرر:", key); // للتشخيص
    });

    this.unsubscribeFns.push(unsubDown, unsubUp);
  }

  getMovementInput() {
    if (this.disabled) return { dx: 0, dy: 0 };
    
    let dx = 0, dy = 0;
    
    if (this.keysPressed["w"] || this.keysPressed["arrowup"]) dy -= 1;
    if (this.keysPressed["s"] || this.keysPressed["arrowdown"]) dy += 1;
    if (this.keysPressed["a"] || this.keysPressed["arrowleft"]) dx -= 1;
    if (this.keysPressed["d"] || this.keysPressed["arrowright"]) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
      console.log("movment", { dx, dy });
    }
    
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

  enable() { 
    this.disabled = false;
    console.log("InputHandler ");
  }

  disable() { 
    this.disabled = true; 
    this.keysPressed = {};
    console.log("InputHandler ");
  }

  destroy() { 
    this.unsubscribeFns.forEach(fn => fn && fn()); 
    this.unsubscribeFns = []; 
    this.keysPressed = {};
  }
}

export function createGameKeyboardInput(eventRegistry) {
  return new VNode("input", {
    id: "game-keyboard-input",
    type: "text",
    tabindex: 0,
    autofocus: true,
    style: "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:auto;width:1px;height:1px;",
    onkeydown: (e) => {
      console.log("Keyboard event dispatched:", e.key);
      eventRegistry.dispatch("keydown", e);
    },
    onkeyup: (e) => {
      eventRegistry.dispatch("keyup", e);
    },
    oninput: (e) => { 
      e.target.value = "";
    },
    onblur: (e) => {
      console.log("Input lost focus, refocusing...");
      setTimeout(() => e.target.focus(), 10);
    },
    onfocus: () => {
      console.log("Keyboard input focused");
    }
  });
}