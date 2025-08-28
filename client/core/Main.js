import { VNode } from "../framework/vdom.js";
import { SocketManager } from "./SocketManager.js";
import { ChatManager } from "./ChatManager.js";
import { BombermanGame } from "../game/bomber.js";

export class Main {
  constructor(container) {
    this.container = container;
    this.socketManager = null;
    this.chatManager = null;
    this.game = null;
    this.nickname = null;
    this.roomId = null;
    this.countdownSeconds = null;
    this.init();
  }

  init() {
    this.renderNicknameForm();
  }

  renderNicknameForm() {
    const vnode = new VNode("div", { class: "nickname-form" }, [
      new VNode("h2", {}, ["Enter your nickname"]),
      new VNode("input", {
        id: "nicknameInput",
        type: "text",
        placeholder: "Nickname (3-16 characters, letters/numbers/_)",
        maxlength: "16"
      }),
      new VNode("button", { onclick: () => this.handleJoin() }, ["Join Lobby"]),
      new VNode("p", { id: "errorMsg", style: "color: red;" }, []),
    ]);
    this.container.innerHTML = "";
    this.container.appendChild(vnode.render(vnode));

    // Focus on input and handle enter key
    const input = document.getElementById("nicknameInput");
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleJoin();
        }
      });
    }
  }

  handleJoin() {
    const input = document.getElementById("nicknameInput");
    const nickname = input.value.trim();
    
    if (!nickname) {
      document.getElementById("errorMsg").textContent = "Please enter a nickname.";
      return;
    }
    
    if (nickname.length < 3 || nickname.length > 16) {
      document.getElementById("errorMsg").textContent = "Nickname must be 3-16 characters long.";
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      document.getElementById("errorMsg").textContent = "Nickname can only contain letters, numbers, and underscores.";
      return;
    }
    
    if (nickname.includes('<3')) {
      document.getElementById("errorMsg").textContent = "Invalid nickname.";
      return;
    }
    
    this.nickname = nickname;
    this.startSocket();
  }

  startSocket() {
    this.socketManager = new SocketManager(this.nickname);

    this.socketManager.on("connected", () => {
      this.renderLobby();
    });

    this.socketManager.on("playerCountUpdate", (count) => {
      this.updatePlayerCount(count);
    });

    this.socketManager.on("chatMessage", (msg) => {
      if (this.chatManager) this.chatManager.addMessage(msg);
    });

    this.socketManager.on("roomJoined", (roomId) => {
      this.roomId = roomId;
      console.log("Joined room:", roomId);
    });

    this.socketManager.on("countdownTick", (seconds) => {
      this.countdownSeconds = seconds;
      this.renderCountdown(seconds);
    });

    this.socketManager.on("gameStart", (gameData) => {
      console.log("Game starting!", gameData);
      this.renderGame(gameData);
    });

    this.socketManager.on("invalidNickname", (reason) => {
      document.getElementById("errorMsg").textContent = reason;
    });

    // Handle connection errors
    this.socketManager.ws.onerror = () => {
      document.getElementById("errorMsg").textContent = "Failed to connect to server. Please try again.";
    };
  }

  renderLobby() {
    const vnode = new VNode("div", { class: "lobby" }, [
      new VNode("h2", {}, [`Welcome, ${this.nickname}!`]),
      new VNode("p", {}, ["Waiting for players to join..."]),
      new VNode("p", { id: "playerCount" }, ["Players in lobby: 1"]),
      new VNode("div", { id: "countdown" }, []), // Countdown UI container
      new VNode("div", { 
        style: "margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px;"
      }, [
        new VNode("h3", {}, ["Game Rules:"]),
        new VNode("ul", {}, [
          new VNode("li", {}, ["Move: WASD or Arrow Keys"]),
          new VNode("li", {}, ["Place Bomb: Spacebar"]),
          new VNode("li", {}, ["Collect powerups to increase bombs, flames, and speed"]),
          new VNode("li", {}, ["Last player standing wins!"]),
        ])
      ]),
      new VNode("div", { id: "chatContainer" }),
    ]);
    this.container.innerHTML = "";
    this.container.appendChild(vnode.render(vnode));

    this.chatManager = new ChatManager(
      document.getElementById("chatContainer"),
      this.socketManager
    );
  }

  updatePlayerCount(count) {
    const el = document.getElementById("playerCount");
    if (el) {
      el.textContent = `Players in lobby: ${count}`;
      
      // Show countdown info based on player count
      if (count === 1) {
        el.textContent += " (Need at least 2 players to start)";
      } else if (count >= 2 && count < 4) {
        if (this.countdownSeconds === null) {
          el.textContent += " (Game will start in 20 seconds, or when 4 players join)";
        }
      } else if (count === 4) {
        el.textContent += " (Game starting in 10 seconds!)";
      }
    }
  }

  renderCountdown(seconds) {
    const countdownEl = document.getElementById("countdown");
    if (countdownEl) {
      if (seconds > 0) {
        countdownEl.innerHTML = `<h3 style="color: #ff6600;">Game starts in: ${seconds}s</h3>`;
      } else {
        countdownEl.innerHTML = '<h3 style="color: #00aa00;">Game Starting!</h3>';
      }
    }
  }

  renderGame(gameData) {
    this.container.innerHTML = ""; // clear previous view

    // Main game layout container
    const gameLayout = document.createElement("div");
    gameLayout.style.display = "flex";
    gameLayout.style.gap = "20px";
    gameLayout.style.height = "100vh";
    gameLayout.style.padding = "10px";

    // Left side - Game area
    const gameArea = document.createElement("div");
    gameArea.style.flex = "1";
    gameArea.style.display = "flex";
    gameArea.style.flexDirection = "column";
    gameArea.style.gap = "10px";

    // Game map container
    const mapContainer = document.createElement("div");
    mapContainer.id = "gameMapContainer";
    mapContainer.style.position = "relative";
    mapContainer.style.border = "2px solid #333";
    mapContainer.style.borderRadius = "5px";
    mapContainer.style.backgroundColor = "#2a2a2a";
    gameArea.appendChild(mapContainer);

    // Player status area
    const statusContainer = document.createElement("div");
    statusContainer.id = "playerStatusArea";
    statusContainer.style.padding = "10px";
    statusContainer.style.backgroundColor = "#f9f9f9";
    statusContainer.style.border = "1px solid #ddd";
    statusContainer.style.borderRadius = "5px";
    statusContainer.style.minHeight = "100px";
    gameArea.appendChild(statusContainer);

    gameLayout.appendChild(gameArea);

    // Right side - Chat container
    const chatContainer = document.createElement("div");
    chatContainer.id = "chatContainer";
    chatContainer.style.width = "300px";
    chatContainer.style.height = "100%";
    chatContainer.style.display = "flex";
    chatContainer.style.flexDirection = "column";
    gameLayout.appendChild(chatContainer);

    this.container.appendChild(gameLayout);

    // Initialize chat manager
    this.chatManager = new ChatManager(chatContainer, this.socketManager);

    // Initialize the game with the received data
    this.game = new BombermanGame(this.socketManager, gameData);
    this.game.init();

    console.log("Game initialized with data:", gameData);
  }
}