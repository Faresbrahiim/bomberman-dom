import { VNode } from "../framework/vdom.js";
import { SocketManager } from "./SocketManager.js";
import { ChatManager } from "./ChatManager.js";
// import { GameMap } from "../game/Map.js";
// main UI

export class Main {
  constructor(container) {
    this.container = container;
    this.socketManager = null;
    this.chatManager = null;
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
        placeholder: "Nickname",
      }),
      new VNode("button", { onclick: () => this.handleJoin() }, ["Join Lobby"]),
      new VNode("p", { id: "errorMsg", style: "color: red;" }, []),
    ]);
    this.container.innerHTML = "";
    this.container.appendChild(vnode.render(vnode));
  }

  handleJoin() {
    const input = document.getElementById("nicknameInput");
    const nickname = input.value.trim();
    if (!nickname) {
      document.getElementById("errorMsg").textContent =
        "Please enter a nickname.";
      return;
    }
    this.nickname = nickname;
    this.startSocket();
  }

  startSocket() {
    this.socketManager = new SocketManager(this.nickname);

    this.socketManager.on("connected", () => {
      // connected to server
      this.renderLobby();
    });

    this.socketManager.on("playerCountUpdate", (count) => {
      this.updatePlayerCount(count);
    });

    this.socketManager.on("chatMessage", (msg) => {
      if (this.chatManager) this.chatManager.addMessage(msg);
    });

    // NEW: listen for room join event and store roomId
    this.socketManager.on("roomJoined", (roomId) => {
      this.roomId = roomId;
      console.log("Joined room:", roomId);
    });

    // NEW: listen for countdown timer ticks
    this.socketManager.on("countdownTick", (seconds) => {
      this.countdownSeconds = seconds;
      this.renderCountdown(seconds);
    });

    // NEW: listen for game start
    this.socketManager.on("gameStart", () => {
      this.renderGame();
    });
  }

  renderLobby() {
    const vnode = new VNode("div", { class: "lobby" }, [
      new VNode("h2", {}, [`Welcome, ${this.nickname}`]),
      new VNode("p", { id: "playerCount" }, ["Players in lobby: 1"]),
      new VNode("div", { id: "countdown" }, []), // Countdown UI container
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
    if (el) el.textContent = `Players in lobby: ${count}`;
  }


  renderCountdown(seconds) {
    const countdownEl = document.getElementById("countdown");
    if (countdownEl) {
      countdownEl.textContent = `Game starts in: ${seconds}s`;
      if (seconds <= 0) {
        countdownEl.textContent = '';
      }
    }
  }

  renderGame() {
    document.getElementById('app').textContent = "hna trandra map w chaat"
  }
}
