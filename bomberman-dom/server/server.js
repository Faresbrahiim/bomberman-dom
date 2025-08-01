// we can buil our server later .... witout using express kima gult a si yusf
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState } from './gameState.js';
import { SocketManager } from './socketManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../client')));

const gameState = new GameState();
const socketManager = new SocketManager(wss, gameState);

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
