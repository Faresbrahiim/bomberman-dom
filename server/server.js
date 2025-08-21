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

// --- Find or create a room with space for a new player ---
function assignPlayerToRoom(ws, nickname) {
  // Find a room with less than 4 players and still waiting
  for (const room of rooms.values()) {
    if (room.clients.size < 4 && room.status === 'waiting') {
      room.clients.set(ws, nickname);
      clientRooms.set(ws, room.id);
      return room;
    }
  }
  // No room found, create new room
  const newRoom = new Room(`room${roomCounter++}`);
  newRoom.clients.set(ws, nickname);
  rooms.set(newRoom.id, newRoom);
  clientRooms.set(ws, newRoom.id);
  return newRoom;
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
          // Assign player to a room
          const room = assignPlayerToRoom(ws, data.nickname);
          console.log(`Player ${data.nickname} joined ${room.id}`);

          // Notify client of their room
          ws.send(JSON.stringify({ type: 'roomJoined', roomId: room.id }));

          broadcastPlayerCount(room.id);

          // Start countdown if enough players
          if (room.clients.size >= 2 && room.status === 'waiting') {
            startCountdown(room);
          }

          // If full room (4 players), shorten countdown
          if (room.clients.size === 4 && room.status === 'countdown') {
            adjustCountdownForFullRoom(room);
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
