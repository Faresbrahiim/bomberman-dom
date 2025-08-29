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

  // --- Overlay Functions ---
  showOverlay(message, options = {}) {
    const existing = document.getElementById("gameOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "gameOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.7)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = 9999;
    overlay.style.color = "#fff";
    overlay.style.fontSize = "2rem";
    overlay.style.textAlign = "center";

    const text = document.createElement("div");
    text.textContent = message;
    overlay.appendChild(text);

    if (options.button) {
      const button = document.createElement("button");
      button.textContent = options.button;
      button.style.marginTop = "20px";
      button.style.padding = "10px 20px";
      button.style.fontSize = "1.2rem";
      button.style.cursor = "pointer";
      button.onclick = () => {
        overlay.remove();
        if (options.onClick) options.onClick();
      };
      overlay.appendChild(button);
    }

    document.body.appendChild(overlay);

    if (!options.persistent && !options.button) {
      setTimeout(() => overlay.remove(), options.duration || 2000);
    }
  }

  showGameOverOverlay(message) {
    this.showOverlay(message, {
      button: "Play Again",
      onClick: () => this.restartGame(),
      persistent: true,
    });
  }

  showWinnerOverlay(message) {
    this.showOverlay(message, { persistent: true });
  }

  restartGame() {
    if (this.game) {
      this.game.destroy(); // stop loop, remove map
      this.game = null;
    }
    this.roomId = null;
    this.countdownSeconds = null;
    this.startSocket();
  }

  // --- Nickname Form ---
  renderNicknameForm() {
    const vnode = new VNode("div", { class: "nickname-form" }, [
      new VNode("h2", {}, ["Enter your nickname"]),
      new VNode("input", {
        id: "nicknameInput",
        type: "text",
        class: "nickname-input",
        placeholder: "Nickname (3-16 characters, letters/numbers/_)",
        maxlength: "16",
      }),
      new VNode(
        "button",
        { class: "join-btn", onclick: () => this.handleJoin() },
        ["Join Lobby"]
      ),
      new VNode("p", { id: "errorMsg", class: "error-msg" }, []),
    ]);
    this.container.innerHTML = "";
    this.container.appendChild(vnode.render(vnode));

    const input = document.getElementById("nicknameInput");
    if (input) {
      input.focus();
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleJoin();
      });
    }
  }

  handleJoin() {
    const input = document.getElementById("nicknameInput");
    const nickname = input.value.trim();

    if (!nickname) {
      document.getElementById("errorMsg").textContent =
        "Please enter a nickname.";
      return;
    }

    if (nickname.length < 3 || nickname.length > 16) {
      document.getElementById("errorMsg").textContent =
        "Nickname must be 3-16 characters long.";
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      document.getElementById("errorMsg").textContent =
        "Nickname can only contain letters, numbers, and underscores.";
      return;
    }

    if (nickname.includes("<3")) {
      document.getElementById("errorMsg").textContent = "Invalid nickname.";
      return;
    }

    this.nickname = nickname;
    this.startSocket();
  }

  // --- Socket and Events ---
  startSocket() {
    this.socketManager = new SocketManager(this.nickname);

    this.socketManager.on("connected", () => this.renderLobby());

    this.socketManager.on("playerCountUpdate", (count) =>
      this.updatePlayerCount(count)
    );

    this.socketManager.on("chatMessage", (msg) => {
      if (this.chatManager) this.chatManager.addMessage(msg);
    });

    this.socketManager.on("roomJoined", (roomId) => {
      this.roomId = roomId;
      console.log("Joined room:", roomId);
    });

    this.socketManager.on("countdownTick", (seconds) =>
      this.renderCountdown(seconds)
    );

    this.socketManager.on("gameStart", (gameData) => this.renderGame(gameData));

    this.socketManager.on("invalidNickname", (reason) => {
      document.getElementById("errorMsg").textContent = reason;
    });

    this.socketManager.on("gameOver", (message) => {
      if (this.game) this.game.disableControls();
      this.showGameOverOverlay(message);
    });

    this.socketManager.on("playerOut", (data) => {
      console.log(`${data.nickname} is out!`);
      if (this.game) this.game.showMessage(`${data.nickname} is out!`);
    });

    this.socketManager.on("winner", (message) => {
      this.showWinnerOverlay(message);
      if (this.game) this.game.showMessage(message);
    });

    this.socketManager.ws.onerror = () => {
      document.getElementById("errorMsg").textContent =
        "Failed to connect to server. Please try again.";
    };
  }

  // --- Lobby ---
  renderLobby() {
    const vnode = new VNode("div", { class: "lobby" }, [
      new VNode("h2", {}, [`Welcome, ${this.nickname}!`]),
      new VNode("p", {}, ["Waiting for players to join..."]),
      new VNode("p", { id: "playerCount", class: "player-count" }, [
        "Players in lobby: 1",
      ]),
      new VNode("div", { id: "countdown", class: "countdown" }, []),
      new VNode("div", { class: "rules-box" }, [
        new VNode("h3", {}, ["Game Rules:"]),
        new VNode("ul", {}, [
          new VNode("li", {}, ["Move: WASD or Arrow Keys"]),
          new VNode("li", {}, ["Place Bomb: Spacebar"]),
          new VNode("li", {}, [
            "Collect powerups to increase bombs, flames, and speed",
          ]),
          new VNode("li", {}, ["Last player standing wins!"]),
        ]),
      ]),
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
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
      if (count === 1)
        el.textContent += " (Need at least 2 players to start)";
      else if (count >= 2 && count < 4) {
        if (this.countdownSeconds === null)
          el.textContent +=
            " (Game will start in 20 seconds, or when 4 players join)";
      } else if (count === 4) {
        el.textContent += " (Game starting in 10 seconds!)";
      }
    }
  }

  renderCountdown(seconds) {
    const countdownEl = document.getElementById("countdown");
    if (countdownEl) {
      if (seconds > 0)
        countdownEl.innerHTML = `<h3 class="countdown-timer">Game starts in: ${seconds}s</h3>`;
      else countdownEl.innerHTML = '<h3 class="countdown-start">Game Starting!</h3>';
    }
  }

  renderGame(gameData) {
    this.container.innerHTML = "";

    const gameLayout = document.createElement("div");
    gameLayout.className = "game-layout";

    const gameArea = document.createElement("div");
    gameArea.className = "game-area";

    const banner = document.createElement("div");
    banner.className = "banner";
    const img = document.createElement("img");
    img.src = "../media/baner.png";
    img.alt = "notFound";
    banner.appendChild(img);
    gameArea.appendChild(banner);

    const mapContainer = document.createElement("div");
    mapContainer.id = "gameMapContainer";
    mapContainer.className = "map-container";
    gameArea.appendChild(mapContainer);

    const statusContainer = document.createElement("div");
    statusContainer.id = "playerStatusArea";
    statusContainer.className = "status-container";
    gameArea.appendChild(statusContainer);

    gameLayout.appendChild(gameArea);

    const chatContainer = document.createElement("div");
    chatContainer.id = "chatContainer";
    chatContainer.className = "chat-container";
    gameLayout.appendChild(chatContainer);

    this.container.appendChild(gameLayout);

    this.chatManager = new ChatManager(chatContainer, this.socketManager);

    this.game = new BombermanGame(this.socketManager, gameData);
    this.game.init();

    console.log("Game initialized with data:", gameData);
  }
}
