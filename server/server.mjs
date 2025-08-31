// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

// =============================================================================
// STEP 2: CONSTANTS AND CONFIGURATION (EXECUTED SECOND - SETUP VALUES)
// =============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const MAX_ROOMS = 100;
const MAX_PLAYERS_PER_ROOM = 4;

// =============================================================================
// STEP 3: GLOBAL VARIABLES (EXECUTED THIRD - STATE CONTAINERS)
// =============================================================================
const rooms = new Map();
const clientRooms = new Map();
let roomCounter = 1;

// =============================================================================
// STEP 4: EXPRESS AND HTTP SERVER SETUP (EXECUTED FOURTH - SERVER CREATION)
// =============================================================================
const app = express();
const server = http.createServer(app);
app.use(express.static(path.join(__dirname, "../client")));

// =============================================================================
// STEP 5: WEBSOCKET SERVER SETUP (EXECUTED FIFTH - WEBSOCKET CREATION)
// =============================================================================
const wss = new WebSocketServer({ server });

// =============================================================================
// STEP 6: UTILITY FUNCTIONS (DEFINED SIXTH - HELPER FUNCTIONS)
// =============================================================================

// --- STEP 6A: NICKNAME VALIDATION ---
function validateNickname(nickname, room) {
  if (!nickname || typeof nickname !== "string") return false;
  if (nickname.includes("<3")) return false;
  if (nickname.length < 3 || nickname.length > 16) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(nickname)) return false;

  if (room) {
    for (const playerData of room.clients.values()) {
      if (playerData.nickname.toLowerCase() === nickname.toLowerCase()) {
        return false;
      }
    }
  }
  return true;
}

// --- STEP 6B: BROADCASTING FUNCTIONS ---
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
  broadcastToRoom(roomId, { type: "playerCount", count: room.clients.size });
}

function broadcastChatMessage(roomId, nickname, message) {
  broadcastToRoom(roomId, { type: "chat", message: `${nickname}: ${message}` });
}

// =============================================================================
// STEP 7: ROOM CLASS DEFINITION (DEFINED SEVENTH - GAME LOGIC STRUCTURE)
// =============================================================================
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Map(); // Map<ws, nickname>
    this.status = "waiting"; // waiting | countdown20 | countdown10 | started | finished
    this.countdownTimer = null;
    this.countdownSeconds = 0;
    this.seed = null;
    this.nextPlayerId = 1;
    this.eliminationCount = 1; // Track elimination order
  }

  // --- PLAYER SPAWN POSITIONS ---
  getPlayerSpawnPosition(playerId) {
    const spawns = [
      { x: 60, y: 60 }, // Top-left
      { x: 780, y: 60 }, // Top-right
      { x: 60, y: 540 }, // Bottom-left
      { x: 780, y: 540 }, // Bottom-right
    ];
    return spawns[playerId - 1] || spawns[0];
  }

  // --- ADD PLAYER TO ROOM ---
  addPlayer(ws, nickname) {
    const playerId = this.nextPlayerId++;
    const spawnPos = this.getPlayerSpawnPosition(playerId);

    this.clients.set(ws, {
      nickname,
      playerId,
      position: spawnPos,
      gridPosition: {
        x: Math.floor(spawnPos.x / 60),
        y: Math.floor(spawnPos.y / 60),
      },
      lives: 3,
      powerups: { bombs: 0, flames: 0, speed: 0 },
    });

    return playerId;
  }

  // --- GAME OVER LOGIC ---
  checkGameOver() {
    if (this.status !== "started") return;

    const alivePlayers = [];
    for (const [ws, playerData] of this.clients.entries()) {
      if (playerData.lives > 0) {
        alivePlayers.push(playerData);
      }
    }

    if (alivePlayers.length <= 1) {
      this.status = "finished";

      // Add the last surviving player to elimination order
      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        if (!winner.eliminationOrder) {
          winner.eliminationOrder = this.eliminationCount++;
        }
      }

      // Create leaderboard (1st = last eliminated, 4th = first eliminated)
      const leaderboard = Array.from(this.clients.values())
        .sort((a, b) => (b.eliminationOrder || 0) - (a.eliminationOrder || 0))
        .map((player, index) => ({
          rank: index + 1,
          playerId: player.playerId,
          nickname: player.nickname,
          lives: player.lives,
        }));

      broadcastToRoom(this.id, {
        type: "gameOver",
        leaderboard: leaderboard,
        winner: leaderboard[0] || null,
      });

      // Return to lobby after showing results
      setTimeout(() => {
        this.returnToLobby();
      }, 5000);
    }
  }

  // --- RETURN TO LOBBY AFTER GAME ---
  returnToLobby() {
    this.status = "waiting";
    this.seed = null;
    this.countdownTimer = null;
    this.countdownSeconds = 0;
    this.eliminationCount = 1;

    // Reset all players
    for (const [ws, playerData] of this.clients.entries()) {
      const spawnPos = this.getPlayerSpawnPosition(playerData.playerId);
      playerData.position = spawnPos;
      playerData.gridPosition = {
        x: Math.floor(spawnPos.x / 60),
        y: Math.floor(spawnPos.y / 60),
      };
      playerData.lives = 3;
      playerData.powerups = { bombs: 0, flames: 0, speed: 0 };
      playerData.eliminationOrder = null;
      playerData.isSpectator = false;
    }

    broadcastToRoom(this.id, {
      type: "returnToLobby",
      message: "Returning to lobby...",
    });

    broadcastPlayerCount(this.id);
  }
}

// =============================================================================
// STEP 8: COUNTDOWN SYSTEM FUNCTIONS (DEFINED EIGHTH - GAME TIMING LOGIC)
// =============================================================================

// --- 20-SECOND COUNTDOWN (WAITING FOR MORE PLAYERS) ---
function start20SecCountdown(room) {
  if (room.status !== "waiting" && room.status !== "countdown20") return;
  room.status = "countdown20";
  room.countdownSeconds = 5;

  room.countdownTimer = setInterval(() => {
    room.countdownSeconds--;
    broadcastToRoom(room.id, {
      type: "countdownTick",
      seconds: room.countdownSeconds,
    });

    if (room.clients.size === MAX_PLAYERS_PER_ROOM) {
      clearInterval(room.countdownTimer);
      start10SecCountdown(room);
    }

    if (room.countdownSeconds <= 0) {
      clearInterval(room.countdownTimer);
      start10SecCountdown(room);
    }
  }, 1000);
}

// --- 10-SECOND COUNTDOWN (GAME STARTING SOON) ---
function start10SecCountdown(room) {
  room.status = "countdown10";
  room.countdownSeconds = 1;

  room.countdownTimer = setInterval(() => {
    room.countdownSeconds--;
    broadcastToRoom(room.id, {
      type: "countdownTick",
      seconds: room.countdownSeconds,
    });

    if (room.countdownSeconds <= 0) {
      clearInterval(room.countdownTimer);
      room.status = "started";

      if (room.seed === null) {
        room.seed = Math.floor(Math.random() * 100) + 1;
      }

      // Collect all player data for game initialization
      const players = [];
      for (const [ws, playerData] of room.clients.entries()) {
        players.push({
          playerId: playerData.playerId,
          nickname: playerData.nickname,
          position: playerData.position,
          gridPosition: playerData.gridPosition,
          lives: playerData.lives,
          powerups: playerData.powerups,
        });
      }

      broadcastToRoom(room.id, {
        type: "gameStart",
        seed: room.seed,
        players,
      });
    }
  }, 1000);
}

// =============================================================================
// STEP 9: ROOM MANAGEMENT FUNCTIONS (DEFINED NINTH - ROOM ASSIGNMENT LOGIC)
// =============================================================================

// --- ROOM ASSIGNMENT LOGIC ---
function assignPlayerToRoom(ws, nickname) {
  // Try to find an existing room with available space
  for (const room of rooms.values()) {
    if (
      (room.status === "waiting" || room.status === "countdown20") &&
      room.clients.size < MAX_PLAYERS_PER_ROOM
    ) {
      if (!validateNickname(nickname, room)) {
        ws.send(
          JSON.stringify({
            type: "invalidNickname",
            reason: "Nickname invalid or already taken",
          })
        );
        return null;
      }

      const playerId = room.addPlayer(ws, nickname);
      clientRooms.set(ws, room.id);

      // Send playerId to the client
      ws.send(JSON.stringify({ type: "playerIdAssigned", playerId }));

      return room;
    }
  }

  // Create a new room if no suitable room exists
  if (rooms.size < MAX_ROOMS) {
    const newRoom = new Room(`room${roomCounter++}`);

    if (!validateNickname(nickname, newRoom)) {
      ws.send(
        JSON.stringify({ type: "invalidNickname", reason: "Nickname invalid" })
      );
      return null;
    }

    const playerId = newRoom.addPlayer(ws, nickname);
    rooms.set(newRoom.id, newRoom);
    clientRooms.set(ws, newRoom.id);

    // Send playerId to the client
    ws.send(JSON.stringify({ type: "playerIdAssigned", playerId }));

    return newRoom;
  }

  return null;
}

// =============================================================================
// STEP 10: WEBSOCKET EVENT LISTENERS (EXECUTED TENTH - WHEN SERVER STARTS)
// =============================================================================
wss.on("connection", (ws) => {
  console.log("New player connected");

  // --- MESSAGE HANDLING (EXECUTED WHEN MESSAGES ARRIVE) ---
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        // --- PLAYER JOINING ---
        case "join": {
          const room = assignPlayerToRoom(ws, data.nickname);
          if (!room) return;

          console.log(`Player ${data.nickname} joined ${room.id}`);
          ws.send(JSON.stringify({ type: "roomJoined", roomId: room.id }));
          broadcastPlayerCount(room.id);

          // Countdown logic based on player count
          if (room.clients.size === 1) {
            // Only 1 player - do nothing, wait for more
          } else if (
            room.clients.size >= 2 &&
            room.clients.size < MAX_PLAYERS_PER_ROOM
          ) {
            if (room.status === "waiting") start20SecCountdown(room);
          } else if (room.clients.size === MAX_PLAYERS_PER_ROOM) {
            if (room.status !== "started" && room.status !== "countdown10") {
              clearInterval(room.countdownTimer);
              start10SecCountdown(room);
            }
          }
          break;
        }

        // --- CHAT MESSAGES ---
        case "chat": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;
          const playerData = room.clients.get(ws);
          const nickname = playerData?.nickname || "Unknown";
          broadcastChatMessage(roomId, nickname, data.message);
          break;
        }

        // --- PLAYER MOVEMENT ---
        case "playerMove": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const playerData = room.clients.get(ws);
          if (playerData) {
            playerData.position = data.position;
            playerData.gridPosition = data.gridPosition;

            // Broadcast to other players in the room
            for (const [otherWs, otherPlayerData] of room.clients.entries()) {
              if (otherWs !== ws && otherWs.readyState === 1) {
                otherWs.send(
                  JSON.stringify({
                    type: "playerMoved",
                    playerId: playerData.playerId,
                    position: data.position,
                    gridPosition: data.gridPosition,
                    movement: data.movement,
                  })
                );
              }
            }
          }
          break;
        }

        // --- BOMB PLACEMENT ---
        case "placeBomb": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const playerData = room.clients.get(ws);
          if (playerData) {
            const bombId = `${playerData.playerId}_${Date.now()}`;

            // Broadcast to other players
            for (const [otherWs, otherPlayerData] of room.clients.entries()) {
              if (otherWs !== ws && otherWs.readyState === 1) {
                otherWs.send(
                  JSON.stringify({
                    type: "bombPlaced",
                    playerId: playerData.playerId,
                    position: data.position,
                    bombId: bombId,
                  })
                );
              }
            }
          }
          break;
        }

        // --- BOMB EXPLOSIONS ---
        case "bombExploded": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;

          // Broadcast explosion to other players
          for (const [otherWs] of rooms.get(roomId)?.clients || []) {
            if (otherWs !== ws && otherWs.readyState === 1) {
              otherWs.send(
                JSON.stringify({
                  type: "bombExploded",
                  bombId: data.bombId,
                  explosionCells: data.explosionCells,
                })
              );
            }
          }
          break;
        }

        // --- WALL DESTRUCTION ---
        case "wallDestroyed": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;

          // Broadcast wall destruction to other players
          for (const [otherWs] of rooms.get(roomId)?.clients || []) {
            if (otherWs !== ws && otherWs.readyState === 1) {
              otherWs.send(
                JSON.stringify({
                  type: "wallDestroyed",
                  position: data.position,
                  powerupRevealed: data.powerupRevealed,
                })
              );
            }
          }
          break;
        }

        // --- POWERUP COLLECTION ---
        case "powerupCollected": {
          const roomId = clientRooms.get(ws);
          if (!roomId) return;

          // Broadcast powerup collection to other players
          for (const [otherWs] of rooms.get(roomId)?.clients || []) {
            if (otherWs !== ws && otherWs.readyState === 1) {
              otherWs.send(
                JSON.stringify({
                  type: "powerupCollected",
                  playerId: data.playerId,
                  position: data.position,
                  powerupType: data.powerupType,
                })
              );
            }
          }
          break;
        }

        // --- PLAYER DEATH ---
        case "playerDied": {
          console.log("ana f server db");
          
          const roomId = clientRooms.get(ws);
          if (!roomId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const playerData = room.clients.get(ws);
          if (playerData) {
            playerData.lives = Math.max(0, playerData.lives - 1);
            console.log(playerData.lives);
            
            // If player is eliminated, mark them as spectator and record elimination order
            if (playerData.lives === 0 && !playerData.eliminationOrder) {
              playerData.isSpectator = true;
              playerData.eliminationOrder = room.eliminationCount++;

              // Broadcast elimination message
              broadcastToRoom(roomId, {
                type: "playerEliminated",
                playerId: playerData.playerId,
                nickname: playerData.nickname,
                eliminationOrder: playerData.eliminationOrder,
              });
            }

            // Broadcast to all players
            broadcastToRoom(roomId, {
              type: "playerDied",
              playerId: playerData.playerId,
              lives: playerData.lives,
            });

            // Check for game over after player death
            room.checkGameOver();
          }
          break;
        }
        
        // --- UNKNOWN MESSAGE TYPES ---
        default:
          console.warn("Unknown message type:", data.type);
      }
    } catch (e) {
      console.error("Invalid message:", message);
    }
  });

  // --- CONNECTION CLOSE HANDLING (EXECUTED WHEN CLIENTS DISCONNECT) ---
  ws.on("close", () => {
    const roomId = clientRooms.get(ws);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const playerData = room.clients.get(ws);
        room.clients.delete(ws);

        // Notify other players about disconnection
        if (playerData) {
          broadcastToRoom(roomId, {
            type: "playerDisconnected",
            playerId: playerData.playerId,
          });
        }

        // Clean up empty rooms
        if (room.clients.size === 0) {
          clearInterval(room.countdownTimer);
          rooms.delete(roomId);
        } else {
          broadcastPlayerCount(roomId);
        }
      }
      clientRooms.delete(ws);
    }
    console.log("Player disconnected");
  });
});

// =============================================================================
// STEP 11: SERVER STARTUP (EXECUTED LAST - STARTS THE SERVER)
// =============================================================================
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});