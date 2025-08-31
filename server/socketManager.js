// server/core/SocketManager.js
export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.ws = new WebSocket("ws://localhost:3000");
    this.eventHandlers = {};

    this.ws.onopen = () => {
      this.send({ type: "join", nickname: this.nickname });
      this.trigger("connected");
    };
    this.socketManager.on("returnToLobby", (message) => {
      this.handleReturnToLobby(message);
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  on(event, callback) {
    this.eventHandlers[event] = callback;
  }

  trigger(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event](data);
    }
  }

  send(data) {
    this.ws.send(JSON.stringify(data));
  }

  handleMessage(data) {
    switch (data.type) {
      case "playerCount":
        this.trigger("playerCountUpdate", data.count);
        break;

      case "chat":
        this.trigger("chatMessage", data.message);
        break;

      default:
        console.warn("Unknown message type:", data.type);
    }
  }

  sendChatMessage(message) {
    this.send({ type: "chat", message });
  }
}
