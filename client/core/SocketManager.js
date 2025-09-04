// =============================================================================
// STEP 1: FILE HEADER COMMENT (EXECUTED FIRST - FILE IDENTIFICATION)
// =============================================================================
// client/core/SocketManager.js

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - WEBSOCKET COMMUNICATION MANAGER)
// =============================================================================
export class SocketManager {
  // =============================================================================
  // STEP 3: CONSTRUCTOR (EXECUTED THIRD - WEBSOCKET CONNECTION INITIALIZATION)
  // =============================================================================
  constructor(nickname) {
    // Store user identification data
    this.nickname = nickname;
    this.playerId = null; // Will be assigned by server

    // Initialize event handling system
    this.eventHandlers = {};

    // Create WebSocket connection to server
    // Detect correct protocol and host for WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;

    // For dev: if running on localhost, connect to port 3000
    const url =
      host.includes("localhost") || host.includes("127.0.0.1")
        ? `${protocol}://localhost:3000`
        : `${protocol}://${host}`;

    this.ws = new WebSocket(url);

    // Setup WebSocket event handlers for connection lifecycle

    // When the socket opens, send join message to backend
    this.ws.onopen = () => {
      this.send({ type: "join", nickname: this.nickname });
      this.trigger("connected");
    };

    // Handle incoming messages from backend
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    // Handle WebSocket errors
    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Handle WebSocket connection closure
    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

  // =============================================================================
  // STEP 4: EVENT SYSTEM SETUP (EXECUTED ON DEMAND - EVENT REGISTRATION)
  // =============================================================================

  // Register event listeners
  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }

  // Trigger registered event handlers
  trigger(eventName, data) {
    if (typeof this.eventHandlers[eventName] === "function") {
      this.eventHandlers[eventName](data);
    }
  }

  // =============================================================================
  // STEP 5: OUTBOUND COMMUNICATION (EXECUTED ON USER ACTIONS - CLIENT TO SERVER)
  // =============================================================================

  // Send data to server
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // =============================================================================
  // STEP 6: INBOUND MESSAGE HANDLING (EXECUTED ON SERVER MESSAGES - SERVER TO CLIENT)
  // =============================================================================

  // Handle incoming messages and trigger appropriate events
  handleMessage(data) {
    switch (data.type) {
      // Lobby and connection events
      case "playerCount":
        this.trigger("playerCountUpdate", data.count);
        break;

      case "chat":
        this.trigger("chatMessage", data.message);
        break;

      case "countdownTick":
        this.trigger("countdownTick", data.seconds);
        break;

      case "gameStart":
        console.log("Game starting with seed:", data.seed);
        console.log("Players in room:", data.players);
        this.trigger("gameStart", { seed: data.seed, players: data.players });
        break;

      case "roomJoined":
        this.trigger("roomJoined", data.roomId);
        break;

      case "playerIdAssigned":
        this.playerId = data.playerId;
        console.log("Assigned player ID:", this.playerId);
        break;

      case "invalidNickname":
        this.trigger("invalidNickname", data.reason);
        break;

      // Game events - real-time gameplay synchronization
      case "playerMoved":
        this.trigger("playerMoved", data);
        break;

      case "bombPlaced":
        this.trigger("bombPlaced", data);
        break;

      case "bombExploded":
        this.trigger("bombExploded", data);
        break;

      case "wallDestroyed":
        this.trigger("wallDestroyed", data);
        break;

      case "powerupCollected":
        this.trigger("powerupCollected", data);
        break;

      case "playerDied":
        this.trigger("playerDied", data);
        break;

      case "playerDisconnected":
        this.trigger("playerDisconnected", data);
        break;

      case "gameOver":
        this.trigger("gameOver", {
          leaderboard: data.leaderboard,
          winner: data.winner,
        });
        break;

      case "gameReset":
        this.trigger("gameReset", data.message);
        break;

      case "returnToLobby":
        this.trigger("returnToLobby", data.message);
        break;

      case "playerEliminated":
        this.trigger("playerEliminated", {
          playerId: data.playerId,
          nickname: data.nickname,
          eliminationOrder: data.eliminationOrder,
        });
        break;

      // Unhandled message types logging
      default:
        console.warn("Unhandled message type:", data.type);
    }
  }

  // =============================================================================
  // STEP 7: GAME-SPECIFIC SENDERS (EXECUTED ON GAME ACTIONS - SPECIALIZED COMMUNICATION)
  // =============================================================================

  // Chat message transmission
  sendChatMessage(message) {
    this.send({ type: "chat", message });
  }

  // Player movement synchronization
  sendPlayerMove(position, gridPosition, movement) {
    this.send({
      type: "playerMove",
      position,
      gridPosition,
      movement, // Add this line
    });
  }

  // Bomb placement notification
  sendPlaceBomb(position) {
    this.send({
      type: "placeBomb",
      position,
    });
  }

  // Bomb explosion event transmission
  sendBombExploded(bombId, explosionCells) {
    this.send({
      type: "bombExploded",
      bombId,
      explosionCells,
    });
  }

  // Wall destruction event notification
  sendWallDestroyed(position, powerupRevealed) {
    this.send({
      type: "wallDestroyed",
      position,
      powerupRevealed,
    });
  }

  // Powerup collection event transmission
  sendPowerupCollected(position, powerupType) {
    this.send({
      type: "powerupCollected",
      playerId: this.playerId,
      position,
      powerupType,
    });
  }

  // Player death notification
  sendPlayerDied() {
    this.send({
      type: "playerDied",
    });
  }
}