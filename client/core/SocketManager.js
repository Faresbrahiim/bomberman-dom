// client/core/SocketManager.js

export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.playerId = null; // Will be assigned by server
    this.eventHandlers = {};
    this.ws = new WebSocket("ws://localhost:3000");

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

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

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

  // Send data to server
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Handle incoming messages and trigger appropriate events
  handleMessage(data) {
    switch (data.type) {
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

      // Game events
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

      default:
        console.warn("Unhandled message type:", data.type);
    }
  }

  // Game-specific message senders
  sendChatMessage(message) {
    this.send({ type: "chat", message });
  }

  sendPlayerMove(position, gridPosition, movement) {
    this.send({
      type: "playerMove",
      position,
      gridPosition,
      movement, // Add this line
    });
  }

  sendPlaceBomb(position) {
    this.send({
      type: "placeBomb",
      position,
    });
  }

  sendBombExploded(bombId, explosionCells) {
    this.send({
      type: "bombExploded",
      bombId,
      explosionCells,
    });
  }

  sendWallDestroyed(position, powerupRevealed) {
    this.send({
      type: "wallDestroyed",
      position,
      powerupRevealed,
    });
  }

  sendPowerupCollected(position, powerupType) {
    this.send({
      type: "powerupCollected",
      playerId: this.playerId,
      position,
      powerupType,
    });
  }

  sendPlayerDied() {
    this.send({
      type: "playerDied",
    });
  }
}
