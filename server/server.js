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
    this.clients = new Map(); // ws -> nickname
    this.status = 'waiting';  // waiting | countdown | started
    this.countdownTimer = null;
    this.countdownSeconds = 0;
  }
}

const rooms = new Map();        // roomId -> Room
const clientRooms = new Map();  // ws -> roomId
let roomCounter = 1;
const MAX_ROOMS = 3;
const MAX_PLAYERS_PER_ROOM = 4;

// --- Assign player to a room ---
function assignPlayerToRoom(ws, nickname) {
  // Join a room with space that hasn't started yet
  for (const room of rooms.values()) {
    if (room.clients.size < MAX_PLAYERS_PER_ROOM && room.status !== 'started') {
      room.clients.set(ws, nickname);
      clientRooms.set(ws, room.id);
      return room;
    }
  }

  // If less than MAX_ROOMS exist, create new room
  if (rooms.size < MAX_ROOMS) {
    const newRoom = new Room(`room${roomCounter++}`);
    newRoom.clients.set(ws, nickname);
    rooms.set(newRoom.id, newRoom);
    clientRooms.set(ws, newRoom.id);
    return newRoom;
  }

  // All rooms full
  return null;
}

// --- Broadcast to a room ---
function broadcastToRoom(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;
  const json = JSON.stringify(data);
  for (const client of room.clients.keys()) {
    if (client.readyState === 1) client.send(json);
  }
}

// --- Player count ---
function broadcastPlayerCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcastToRoom(roomId, { type: 'playerCount', count: room.clients.size });
}

// --- Chat ---
function broadcastChatMessage(roomId, nickname, message) {
  broadcastToRoom(roomId, { type: 'chat', message: `${nickname}: ${message}` });
}

// --- Countdown ---
function startCountdown(room) {
  if (room.status !== 'waiting') return;
  room.status = 'countdown';
  room.countdownSeconds = 20;

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

// --- Adjust countdown if room fills early ---
function adjustCountdownForFullRoom(room) {
  if (room.countdownSeconds > 10) room.countdownSeconds = 10;
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
          // Otherwise, start countdown if 2+ players
          else if (room.clients.size >= 2 && room.status === 'waiting') {
            startCountdown(room);
          }
          // If room reaches 4 during countdown, shorten it
          else if (room.clients.size === MAX_PLAYERS_PER_ROOM && room.status === 'countdown') {
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
