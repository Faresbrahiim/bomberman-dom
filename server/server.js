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

// --- Room class --- ,, is construct the room with the websocket and  their nickname ,, when create instance means create room 
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map(); // Map<ws, nickname>
    this.status = 'waiting';  // waiting | countdown20 | countdown10 | started
    this.countdownTimer = null;
    this.countdownSeconds = 0;
    this.seed = null; // <-- new: store random seed for this room
  }
}

// --- Room tracking ---
const rooms = new Map();        // Map<roomId, Room> => roomis : roomName .. active rooms
const clientRooms = new Map();  // Map<ws, roomId> 
let roomCounter = 1;

const MAX_ROOMS = 100;
const MAX_PLAYERS_PER_ROOM = 4;

/** -----------------------
 *  Nickname validation
 *  -----------------------
 *  - non-empty string
 *  - no "<3"
 *  - 3..16 chars
 *  - alphanumeric + underscore only
 */
function validateNickname(nickname) {
  if (!nickname || typeof nickname !== 'string') {
    return { ok: false, reason: 'Nickname required' };
  }
  if (nickname.includes('<3')) {
    return { ok: false, reason: 'Nickname cannot contain "<3"' };
  }
  if (nickname.length < 3 || nickname.length > 16) {
    return { ok: false, reason: 'Nickname must be 3–16 chars' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
    return { ok: false, reason: 'Use letters, numbers or _ only' };
  }
  return { ok: true };
}

/** check if the nickname already exists **in that room** (case-insensitive) */
function nicknameTakenInRoom(room, nickname) {
  const lower = nickname.toLowerCase();
  for (const existing of room.clients.values()) {
    if (existing.toLowerCase() === lower) return true;
  }
  return false;
}

/** check if the nickname already exists GLOBALLY across all rooms (case-insensitive) */
function nicknameTakenGlobal(nickname) {
  const lower = nickname.toLowerCase();
  for (const room of rooms.values()) {
    for (const existing of room.clients.values()) {
      if (existing.toLowerCase() === lower) {
        console.log(`Nickname ${nickname} is already taken by ${existing}`);
        return true;
      }
    }
  }
  return false;
}

// --- Assign player to a room ---
function assignPlayerToRoom(ws, nickname) {
  console.log(`Attempting to assign player: ${nickname}`); // DEBUG
  
  // 1) validate first (before touching rooms)
  const vr = validateNickname(nickname);
  if (!vr.ok) {
    console.log(`Nickname validation failed: ${vr.reason}`); // DEBUG
    ws.send(JSON.stringify({ type: 'invalidNickname', reason: vr.reason }));
    return null;
  }

  // 2) reject if nickname exists anywhere (GLOBAL uniqueness)
  if (nicknameTakenGlobal(nickname)) {
    console.log(`Nickname ${nickname} already taken globally`); // DEBUG
    ws.send(JSON.stringify({ type: 'invalidNickname', reason: 'Nickname already taken' }));
    return null;
  }

  // 3) try to place in an existing room with capacity (status waiting|countdown20)
  for (const room of rooms.values()) {
    if ((room.status === 'waiting' || room.status === 'countdown20') &&
        room.clients.size < MAX_PLAYERS_PER_ROOM) {
      room.clients.set(ws, nickname);
      clientRooms.set(ws, room.id);
      console.log(`Player ${nickname} assigned to existing room ${room.id}`); // DEBUG
      return room;
    }
  }

  // 4) otherwise create a new room (if capacity)
  if (rooms.size < MAX_ROOMS) {
    const newRoom = new Room(`room${roomCounter++}`);
    newRoom.clients.set(ws, nickname);
    rooms.set(newRoom.id, newRoom);
    clientRooms.set(ws, newRoom.id);
    console.log(`Player ${nickname} assigned to new room ${newRoom.id}`); // DEBUG
    return newRoom;
  }

  // 5) no capacity at all
  console.log(`No room capacity for ${nickname}`); // DEBUG
  ws.send(JSON.stringify({ type: 'roomFull' }));
  return null;
}

// --- Broadcast to room ---//
// give the id and the data to to brodcast it 
function broadcastToRoom(roomId, data) {
  // get the room by id from the map
  const room = rooms.get(roomId);
  if (!room) return;
  const json = JSON.stringify(data);
  // loop for the ws in the room -> and brodcast the data...
  for (const client of room.clients.keys()) {
    if (client.readyState === 1) client.send(json);
  }
}
// brodcast player count to speciefic room 
function broadcastPlayerCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  broadcastToRoom(roomId, { type: 'playerCount', count: room.clients.size });
}
// brodcast the room to the message 
function broadcastChatMessage(roomId, nickname, message) {
  broadcastToRoom(roomId, { type: 'chat', message: `${nickname}: ${message}` });
}

// --- Countdown logic --- for 20 seconds
// accept the room object
function start20SecCountdown(room) {
  if (room.status !== 'waiting' && room.status !== 'countdown20') return;
  room.status = 'countdown20';
  room.countdownSeconds = 20;

  room.countdownTimer = setInterval(() => {
    // each time the set interval run ,,,, decrease -1 sc and brodcast it 
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

      // Generate random seed (1–100) if not already set
      if (room.seed === null) {
        room.seed = Math.floor(Math.random() * 100) + 1;
      }

      // Collect player nicknames
      const players = Array.from(room.clients.values());

      // Send seed and players to all clients in the room
      broadcastToRoom(room.id, {
        type: 'gameStart',
        seed: room.seed,
        players
      });

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
          const nickname = String(data.nickname || '').trim();
          const room = assignPlayerToRoom(ws, nickname);

          if (!room) {
            // if assign failed → already responded with invalidNickname or roomFull
            return;
          }

          console.log(`Player ${nickname} joined ${room.id}`);
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