// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { VNode } from "../framework/vdom.js";
import { updateElement } from "../framework/VDOMmanager.js";
import { SocketManager } from "./SocketManager.js";
import { ChatManager } from "./ChatManager.js";
import { BombermanGame } from "../game/bomber.js";

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - APPLICATION MAIN CONTROLLER)
// =============================================================================
export class Main {
  // =============================================================================
  // STEP 3: CONSTRUCTOR (EXECUTED THIRD - APPLICATION INITIALIZATION)
  // =============================================================================
  constructor(container) {
    // Store DOM container reference
    this.container = container;
    
    // Initialize core component references as null (will be created later)
    this.socketManager = null;
    this.chatManager = null;
    this.game = null;
    
    // Initialize user session data
    this.nickname = null;
    this.roomId = null;
    
    // Initialize countdown state tracking
    this.countdownSeconds = null;
    this.oldCountdownVNode = null;
    
    // Start application flow
    this.init();
  }

  // =============================================================================
  // STEP 4: APPLICATION INITIALIZATION (EXECUTED FOURTH - START USER FLOW)
  // =============================================================================
  init() {
    // Begin user journey with nickname entry form
    this.renderNicknameForm();
  }

  // =============================================================================
  // STEP 5: NICKNAME FORM RENDERING (EXECUTED ON INIT - USER INPUT COLLECTION)
  // =============================================================================
  renderNicknameForm() {
    // Create nickname input form VNode structure
    const vnode = new VNode("div", { class: "nickname-form" }, [
      new VNode("h2", {}, ["Enter your nickname"]),
      // Input field with Enter key handling
      new VNode("input", {
        id: "nicknameInput",
        type: "text",
        class: "nickname-input",
        placeholder: "Nickname (3-16 characters, letters/numbers/_)",
        maxlength: "16",
        onkeydown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // prevent default Enter behavior
            this.handleJoin();  // call your join handler
            e.target.focus();   // keep focus on the input
          }
        }
      }),
      // Join button with click handler
      new VNode(
        "button",
        { class: "join-btn", onclick: () => this.handleJoin() },
        ["Join Lobby"]
      ),
      // Error message display area
      new VNode("p", { id: "errorMsg", class: "error-msg" }, []),
    ]);

    // Clear container and render nickname form
    this.container.innerHTML = "";
    const rendered = vnode.render();
    this.container.appendChild(rendered);

    // Store references to form elements for later use
    this.nicknameInput = rendered.querySelector("#nicknameInput");
    this.errorMsgEl = rendered.querySelector("#errorMsg");

    // Auto-focus on input field for better UX
    if (this.nicknameInput) this.nicknameInput.focus();
  }

  // =============================================================================
  // STEP 6: JOIN HANDLING (EXECUTED ON USER ACTION - NICKNAME VALIDATION)
  // =============================================================================
  handleJoin() {
    // Validate element references exist
    if (!this.nicknameInput || !this.errorMsgEl) return;
    const nickname = this.nicknameInput.value.trim();

    // Validate nickname requirements with error messaging
    if (!nickname) return (this.errorMsgEl.textContent = "Please enter a nickname.");
    if (nickname.length < 3 || nickname.length > 16)
      return (this.errorMsgEl.textContent = "Nickname must be 3-16 characters long.");
    if (!/^[a-zA-Z0-9_]+$/.test(nickname))
      return (this.errorMsgEl.textContent = "Nickname can only contain letters, numbers, and underscores.");
    if (nickname.includes("<3")) return (this.errorMsgEl.textContent = "Invalid nickname.");

    // Store validated nickname and proceed to socket connection
    this.nickname = nickname;
    this.startSocket();
  }

  // =============================================================================
  // STEP 7: SOCKET INITIALIZATION (EXECUTED AFTER VALIDATION - NETWORK CONNECTION)
  // =============================================================================
  startSocket() {
    // Create socket manager instance with validated nickname
    this.socketManager = new SocketManager(this.nickname);

    // Register event handlers for all socket events
    this.socketManager.on("connected", () => this.renderLobby());
    this.socketManager.on("playerCountUpdate", (count) => this.updatePlayerCount(count));
    this.socketManager.on("chatMessage", (msg) => this.chatManager?.addMessage(msg));
    this.socketManager.on("roomJoined", (roomId) => (this.roomId = roomId));
    this.socketManager.on("countdownTick", (seconds) => this.renderCountdown(seconds));
    this.socketManager.on("gameStart", (data) => this.renderGame(data));
    this.socketManager.on("invalidNickname", (reason) => this.errorMsgEl && (this.errorMsgEl.textContent = reason));
    this.socketManager.ws.onerror = () => this.errorMsgEl && (this.errorMsgEl.textContent = "Failed to connect to server. Please try again.");
  }

  // =============================================================================
  // STEP 8: LOBBY RENDERING (EXECUTED ON CONNECTION - WAITING ROOM DISPLAY)
  // =============================================================================
  renderLobby() {
    // Create lobby interface VNode structure
    const vnode = new VNode("div", { class: "lobby" }, [
      // Welcome message with user nickname
      new VNode("h2", {}, [`Welcome, ${this.nickname}!`]),
      new VNode("p", {}, ["Waiting for players to join..."]),
      // Player count display
      new VNode("p", { id: "playerCount", class: "player-count" }, ["Players in lobby: 1"]),
      // Countdown display container
      new VNode("div", { id: "countdown", class: "countdown" }, []),
      // Game rules information box
      new VNode("div", { class: "rules-box" }, [
        new VNode("h3", {}, ["Game Rules:"]),
        new VNode("ul", {}, [
          new VNode("li", {}, ["Move: WASD or Arrow Keys"]),
          new VNode("li", {}, ["Place Bomb: Spacebar"]),
          new VNode("li", {}, ["Collect powerups to increase bombs, flames, and speed"]),
          new VNode("li", {}, ["Last player standing wins!"]),
        ]),
      ]),
      // Chat container placeholder
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
    ]);

    // Clear container and render lobby interface
    this.container.innerHTML = "";
    const rendered = vnode.render();
    this.container.appendChild(rendered);

    // Store references to dynamic elements
    this.playerCountEl = rendered.querySelector("#playerCount");
    this.countdownContainer = rendered.querySelector("#countdown");
    
    // Initialize chat manager with rendered chat container
    this.chatManager = new ChatManager(rendered.querySelector("#chatContainer"), this.socketManager);
  }

  // =============================================================================
  // STEP 9: PLAYER COUNT UPDATE (EXECUTED ON SOCKET EVENT - LOBBY STATUS UPDATE)
  // =============================================================================
  updatePlayerCount(count) {
    // Validate element reference exists
    if (!this.playerCountEl) return;

    // Generate appropriate status message based on player count
    let text = `Players in lobby: ${count}`;
    if (count === 1) text += " (Need at least 2 players to start)";
    else if (count >= 2 && count < 4 && this.countdownSeconds === null)
      text += " (Game will start in 20 seconds, or when 4 players join)";
    else if (count === 4) text += " (Game starting in 10 seconds!)";

    // Update player count display
    this.playerCountEl.textContent = text;
  }

  // =============================================================================
  // STEP 10: COUNTDOWN RENDERING (EXECUTED ON SOCKET EVENT - GAME START TIMER)
  // =============================================================================
  renderCountdown(seconds) {
    // Validate countdown container exists
    if (!this.countdownContainer) return;

    // Create countdown display VNode with dynamic content
    const countdownVNode = new VNode("div", { id: "countdown" }, [
      seconds > 0
        ? new VNode("h3", { class: "countdown-timer" }, [`Game starts in: ${seconds}s`])
        : new VNode("h3", { class: "countdown-start" }, ["Game Starting!"]),
    ]);

    // Update DOM element using VDOM diffing algorithm
    updateElement(this.countdownContainer, countdownVNode, this.oldCountdownVNode);
    
    // Store current VNode for next update comparison
    this.oldCountdownVNode = countdownVNode;
    this.countdownSeconds = seconds;
  }

  // =============================================================================
  // STEP 11: GAME RENDERING (EXECUTED ON GAME START - MAIN GAME INTERFACE)
  // =============================================================================
  renderGame(gameData) {
    // Create game layout VNode structure with all game components
    const gameLayout = new VNode("div", { class: "game-layout" }, [
      // Main game area containing map and status
      new VNode("div", { class: "game-area" }, [
        // Game banner/logo
        new VNode("div", { class: "banner" }, [
          new VNode("img", { src: "../media/baner.png", alt: "notFound" }),
        ]),
        // Game map container
        new VNode("div", { id: "gameMapContainer", class: "map-container" }),
        // Player status display area
        new VNode("div", { id: "playerStatusArea", class: "status-container" }),
      ]),
      // Chat interface container
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
    ]);

    // Clear container and render game layout
    this.container.innerHTML = "";
    const renderedElement = gameLayout.render();
    this.container.appendChild(renderedElement);

    // Store references to game containers
    this.mapContainer = renderedElement.querySelector("#gameMapContainer");
    const chatContainer = renderedElement.querySelector("#chatContainer");
    
    // Initialize chat manager for game phase
    this.chatManager = new ChatManager(chatContainer, this.socketManager);

    // Initialize and start the main game instance
    this.game = new BombermanGame(this.socketManager, gameData, this.mapContainer);
    this.game.init();
  }

  // =============================================================================
  // STEP 12: SPECTATOR MODE (EXECUTED ON PLAYER ELIMINATION - OBSERVER INTERFACE)
  // =============================================================================
  showSpectatorMessage() {
    // Validate map container exists
    if (!this.mapContainer) return;
    // Prevent duplicate spectator overlays
    if (this.mapContainer.querySelector("#spectatorOverlay")) return;

    // Create spectator mode overlay VNode
    const overlayVNode = new VNode("div", { id: "spectatorOverlay", class: "spectator-overlay" }, [
      new VNode("div", { class: "spectator-message" }, [
        new VNode("h3", {}, ["SPECTATOR MODE"]),
        new VNode("p", {}, ["You have been eliminated. Watch the remaining players!"]),
      ]),
    ]);

    // Add spectator overlay to game map container
    this.mapContainer.appendChild(overlayVNode.render());
  }
}