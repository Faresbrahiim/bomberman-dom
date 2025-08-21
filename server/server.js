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

// --- Room class ---
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map(); // Map<ws, nickname>
    this.status = 'waiting';  // waiting | countdown20 | countdown10 | started
    this.countdownTimer = null;
    this.countdownSeconds = 0;
  }
}

// --- Room tracking ---
const rooms = new Map();        // Map<roomId, Room>
const clientRooms = new Map();  // Map<ws, roomId>
let roomCounter = 1;

const MAX_ROOMS = 3;
const MAX_PLAYERS_PER_ROOM = 4;

// --- Assign player to a room ---
function assignPlayerToRoom(ws, nickname) {
  for (const room of rooms.values()) {
    if ((room.status === 'waiting' || room.status === 'countdown20') &&
        room.clients.size < MAX_PLAYERS_PER_ROOM) {
      room.clients.set(ws, nickname);
      clientRooms.set(ws, room.id);
      return room;
    }
  }

  if (rooms.size < MAX_ROOMS) {
    const newRoom = new Room(`room${roomCounter++}`);
    newRoom.clients.set(ws, nickname);
    rooms.set(newRoom.id, newRoom);
    clientRooms.set(ws, newRoom.id);
    return newRoom;
  }

  // All rooms full or countdown10/started → cannot join
  return null;
}

// --- Broadcast to room ---
function broadcastToRoom(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;
  const json = JSON.stringify(data);
  for (const client of room.clients.keys()) {
    if (client.readyState === 1) client.send(json);
  }
}

function broadcastPlayerCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcastToRoom(roomId, { type: 'playerCount', count: room.clients.size });
}

function broadcastChatMessage(roomId, nickname, message) {
  broadcastToRoom(roomId, { type: 'chat', message: `${nickname}: ${message}` });
}

// --- Countdown logic ---
function start20SecCountdown(room) {
  if (room.status !== 'waiting' && room.status !== 'countdown20') return;
  room.status = 'countdown20';
  room.countdownSeconds = 20;

  room.countdownTimer = setInterval(() => {
    room.countdownSeconds--;
    broadcastToRoom(room.id, { type: 'countdownTick', seconds: room.countdownSeconds });

    // If 4 players join during 20s countdown → skip to 10s countdown
    if (room.clients.size === MAX_PLAYERS_PER_ROOM) {
      clearInterval(room.countdownTimer);
      start10SecCountdown(room);
    }

    // If 20s reached → start 10s countdown
    if (room.countdownSeconds <= 0) {
      clearInterval(room.countdownTimer);
      start10SecCountdown(room);
    }
  }, 1000);
}

function start10SecCountdown(room) {
  room.status = 'countdown10';
  room.countdownSeconds = 10;

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

// --- WebSocket connections ---
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

          // Decide countdown
          if (room.clients.size === 1) {
            // Only 1 player → do nothing
          } else if (room.clients.size >= 2 && room.clients.size < MAX_PLAYERS_PER_ROOM) {
            // 2 or 3 players → start 20s countdown if not started
            if (room.status === 'waiting') start20SecCountdown(room);
          } else if (room.clients.size === MAX_PLAYERS_PER_ROOM) {
            // 4 players → start 10s countdown immediately
            if (room.status !== 'started' && room.status !== 'countdown10') {
              clearInterval(room.countdownTimer);
              start10SecCountdown(room);
            }
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
