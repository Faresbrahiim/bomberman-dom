export class SocketManager {
  constructor(nickname) {
    this.nickname = nickname;
    this.eventHandlers = {};
    this.ws = new WebSocket('ws://localhost:3000');
    
    // when the socket open send join msg to backend -> so can join room or assign room 
    this.ws.onopen = () => {
      this.send({ type: 'join', nickname: this.nickname });
      // DON'T trigger 'connected' here - wait for server confirmation
    };
    
    // when msg comes from backend ,,.. 
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  // on is the event ,, -> callback  _ store the func by the key ...  {it's like add event listener almost ,,,} or like on msg but will used separately from socketmanager
  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }

  // trigger -> -> trigger the event ,,,, and run the func we filled by on funct 
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
    console.log('Received message:', data); // DEBUG: see what messages we get
    
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
        console.log('Room joined successfully, triggering connected'); 
        this.trigger('connected');
        this.trigger('roomJoined', data.roomId);
        break;
      case 'invalidNickname':
        console.log("Invalid nickname:", data.reason);
        this.trigger('invalidNickname', data.reason || 'Invalid nickname');
        break;
      case 'roomFull':
        console.log("Room full");
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