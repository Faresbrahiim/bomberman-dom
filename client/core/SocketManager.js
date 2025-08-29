export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.playerId = null;
    this.eventHandlers = {};
    this.ws = new WebSocket("ws://localhost:3000");

    this.ws.onopen = () => {
      this.send({ type: "join", nickname: this.nickname });
      this.trigger("connected");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => console.error("WebSocket error:", error);
    this.ws.onclose = () => console.log("WebSocket connection closed");
  }

  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }

  trigger(eventName, data) {
    if (typeof this.eventHandlers[eventName] === "function") {
      this.eventHandlers[eventName](data);
    }
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

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
        this.trigger("gameStart", { seed: data.seed, players: data.players });
        break;
      case "roomJoined":
        this.trigger("roomJoined", data.roomId);
        break;
      case "playerIdAssigned":
        this.playerId = data.playerId;
        break;
      case "invalidNickname":
        this.trigger("invalidNickname", data.reason);
        break;
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
        this.trigger("gameOver", data.message);
        break;
      case "playerOut":
        this.trigger("playerOut", {
          playerId: data.playerId,
          nickname: data.nickname,
        });
        break;
      case "winner":
        this.trigger("winner", data.message);
        break;
      default:
        console.warn("Unhandled message type:", data.type);
    }
  }

  sendChatMessage(message) {
    this.send({ type: "chat", message });
  }

  sendPlayerMove(position, gridPosition, movement) {
    this.send({ type: "playerMove", position, gridPosition, movement });
  }

  sendPlaceBomb(position) {
    this.send({ type: "placeBomb", position });
  }

  sendBombExploded(bombId, explosionCells) {
    this.send({ type: "bombExploded", bombId, explosionCells });
  }

  sendWallDestroyed(position, powerupRevealed) {
    this.send({ type: "wallDestroyed", position, powerupRevealed });
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
    this.send({ type: "playerDied" });
  }
}
