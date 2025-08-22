export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.eventHandlers = {};
    this.ws = new WebSocket('ws://localhost:3000');
    // when the socket open send join msf to backend -> so can join room or assign room 
    this.ws.onopen = () => {
      this.send({ type: 'join', nickname: this.nickname });
      this.trigger('connected');
    };
    // when msg comes from backend ,,.. 
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
  // on is the event ,, -> callback  _ dtore the func by the key ...  {it's like add event listner almost ,,,} or like on msg but will used separlty from socketmanager
  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }
  // triger -> -> triggeer the event ,,,, and run the func we filled by on  funct 
  // Keeps message parsing and UI logic separate.
  trigger(eventName, data) {
    if (typeof this.eventHandlers[eventName] === 'function') {
      this.eventHandlers[eventName](data);
    }
  }

  send(data) {
    this.ws.send(JSON.stringify(data));
  }
  // data == msg
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
        console.log('Seed:', data.seed);
        console.log('Players in room:', data.players);
        this.trigger('gameStart');
        break;
      case 'roomJoined':
        this.trigger('roomJoined', data.roomId);
        break;
      case 'invalidNickname':
        console.log("invalid nickname ?" , data.reason);
        this.trigger('invalidNickname', data.reason || 'Invalid nickname');
        // optional: keep socket open so user can try again without reloading
        break;

      case 'roomFull':
        this.trigger('roomFull');
        break;
      default:
        console.warn('Unhandled message type:', data.type);
    }
  }

  sendChatMessage(message) {
    this.send({ type: 'chat', message });
  }
}
