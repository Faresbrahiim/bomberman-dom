export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.eventHandlers = {};
    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onopen = () => {
      this.send({ type: 'join', nickname: this.nickname });
      this.trigger('connected');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }

  trigger(eventName, data) {
    if (typeof this.eventHandlers[eventName] === 'function') {
      this.eventHandlers[eventName](data);
    }
  }

  send(data) {
    this.ws.send(JSON.stringify(data));
  }

  handleMessage(data) {
    switch (data.type) {
      case 'playerCount':
        this.trigger('playerCountUpdate', data.count);
        break;
      case 'chat':
        this.trigger('chatMessage', data.message);
        break;
      case 'countdownTick':
        this.trigger('countdownTick', data.seconds);
        break;
      case 'gameStart':
        this.trigger('gameStart');
        break;
      case 'roomJoined':
        this.trigger('roomJoined', data.roomId);
        break;
      default:
        console.warn('Unhandled message type:', data.type);
    }
  }

  sendChatMessage(message) {
    this.send({ type: 'chat', message });
  }
}
