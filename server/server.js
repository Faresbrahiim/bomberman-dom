import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
app.use(express.static(path.join(__dirname, '../client')));
const wss = new WebSocketServer({ server });

// --- NEW: Room class to track players and countdown ---
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map(); // Map of ws -> nickname
    this.status = 'waiting';  // 'waiting' | 'countdown' | 'started'
    this.countdownTimer = null;
    this.countdownSeconds = 0;
  }
}

// --- NEW: Keep track of rooms and which room a client is in ---
const rooms = new Map();        // Map<roomId, Room>
const clientRooms = new Map();  // Map<ws, roomId>
let roomCounter = 1;
const MAX_ROOMS = 3;
const MAX_PLAYERS_PER_ROOM = 4;

// --- Find or create a room with space for a new player ---
function assignPlayerToRoom(ws, nickname) {
  // Try to find a room that has less than 4 players
  for (const room of rooms.values()) {
    if (room.clients.size < MAX_PLAYERS_PER_ROOM && room.status === 'waiting') {
      room.clients.set(ws, nickname);
      clientRooms.set(ws, room.id);
      return room;
    }
  }

  // If less than MAX_ROOMS exist, create a new room
  if (rooms.size < MAX_ROOMS) {
    const newRoom = new Room(`room${roomCounter++}`);
    newRoom.clients.set(ws, nickname);
    rooms.set(newRoom.id, newRoom);
    clientRooms.set(ws, newRoom.id);
    return newRoom;
  }

  // If all rooms are full, return null (or handle waiting queue)
  return null;
}


// --- Broadcast only to clients in the same room ---
function broadcastToRoom(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;
  const json = JSON.stringify(data);
  for (const client of room.clients.keys()) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

// --- Broadcast player count in a room ---
function broadcastPlayerCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcastToRoom(roomId, { type: 'playerCount', count: room.clients.size });
}

// --- Broadcast chat message in a room ---
function broadcastChatMessage(roomId, nickname, message) {
  broadcastToRoom(roomId, { type: 'chat', message: `${nickname}: ${message}` });
}

// --- Start countdown in a room ---
function startCountdown(room) {
  if (room.status !== 'waiting') return;
  room.status = 'countdown';
  room.countdownSeconds = 20; // start countdown at 20 seconds

  // Send countdown tick every second
  room.countdownTimer = setInterval(() => {
    room.countdownSeconds--;

    broadcastToRoom(room.id, { type: 'countdownTick', seconds: room.countdownSeconds });

    if (room.countdownSeconds <= 0) {
      clearInterval(room.countdownTimer);
      room.status = 'started';
      broadcastToRoom(room.id, { type: 'gameStart' });
    }
  }, 1000);
}

// --- Adjust countdown if 4 players join early ---
function adjustCountdownForFullRoom(room) {
  if (room.countdownSeconds > 10) {
    room.countdownSeconds = 10; // shorten countdown to 10 seconds
  }
}

wss.on('connection', (ws) => {
  console.log('New player connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'join': {
          const room = assignPlayerToRoom(ws, data.nickname);

          if (!room) {
            ws.send(JSON.stringify({ type: 'roomFull' }));
            return;
          }

          console.log(`Player ${data.nickname} joined ${room.id}`);
          ws.send(JSON.stringify({ type: 'roomJoined', roomId: room.id }));
          broadcastPlayerCount(room.id);

          // Start game immediately if room is full
          if (room.clients.size === MAX_PLAYERS_PER_ROOM && room.status !== 'started') {
            clearInterval(room.countdownTimer);
            room.status = 'started';
            broadcastToRoom(room.id, { type: 'gameStart' });
          }
          // Otherwise, start countdown if at least 2 players
          else if (room.clients.size >= 2 && room.status === 'waiting') {
            startCountdown(room);
          }

          break;
        }


        case 'chat': {
        const roomId = clientRooms.get(ws);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const nickname = room.clients.get(ws) || 'Unknown';
        broadcastChatMessage(roomId, nickname, data.message);
        break;
      }

        default:
      console.warn('Unknown message type:', data.type);
    }
    } catch (e) {
    console.error('Invalid message:', message);
  }
});

ws.on('close', () => {
  const roomId = clientRooms.get(ws);
  if (roomId) {
    const room = rooms.get(roomId);
    if (room) {
      room.clients.delete(ws);

      // If room empty, delete it
      if (room.clients.size === 0) {
        clearInterval(room.countdownTimer);
        rooms.delete(roomId);
      } else {
        broadcastPlayerCount(roomId);
      }
    }
    clientRooms.delete(ws);
  }
  console.log('Player disconnected');
});
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
