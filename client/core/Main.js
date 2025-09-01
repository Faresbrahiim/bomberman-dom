import { VNode } from "../framework/vdom.js";
import { updateElement } from "../framework/VDOMmanager.js";

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

    // Focus on input and handle enter key
    const input = document.getElementById("nicknameInput");
    if (input) {
      input.focus();
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleJoin();
        }
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

    this.socketManager.ws.onerror = () => {
      document.getElementById("errorMsg").textContent =
        "Failed to connect to server. Please try again.";
    };
  }

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
    const rendered = vnode.render();
    this.container.appendChild(rendered);

    // Store reference to the countdown container
    this.countdownContainer = rendered.querySelector("#countdown");

    this.chatManager = new ChatManager(
      rendered.querySelector("#chatContainer"),
      this.socketManager
    );
  }

  updatePlayerCount(count) {
    const el = document.getElementById("playerCount");
    if (el) {
      el.textContent = `Players in lobby: ${count}`;

      if (count === 1) {
        el.textContent += " (Need at least 2 players to start)";
      } else if (count >= 2 && count < 4) {
        if (this.countdownSeconds === null) {
          el.textContent +=
            " (Game will start in 20 seconds, or when 4 players join)";
        }
      } else if (count === 4) {
        el.textContent += " (Game starting in 10 seconds!)";
      }
    }
  }

  renderCountdown(seconds) {
    if (!this.countdownContainer) return; // safeguard

    const countdownVNode = new VNode(
      "div",
      { id: "countdown" },
      [
        seconds > 0
          ? new VNode("h3", { class: "countdown-timer" }, [
            `Game starts in: ${seconds}s`,
          ])
          : new VNode("h3", { class: "countdown-start" }, ["Game Starting!"]),
      ]
    );

    updateElement(this.countdownContainer, countdownVNode, this.oldCountdownVNode);
    this.oldCountdownVNode = countdownVNode;
  }


  renderGame(gameData) {
    this.container.innerHTML = "";

    // Create the game layout using VNode
    const gameLayout = new VNode("div", { class: "game-layout" }, [
      new VNode("div", { class: "game-area" }, [
        new VNode("div", { class: "banner" }, [
          new VNode("img", {
            src: "../media/baner.png",
            alt: "notFound"
          })
        ]),
        new VNode("div", {
          id: "gameMapContainer",
          class: "map-container"
        }),
        new VNode("div", {
          id: "playerStatusArea",
          class: "status-container"
        })
      ]),
      new VNode("div", {
        id: "chatContainer",
        class: "chat-container"
      })
    ]);

    // Render the VNode to actual DOM and append to container
    const renderedElement = gameLayout.render();
    this.container.appendChild(renderedElement);

    // Get chat container from the rendered element instead of DOM query
    const chatContainer = renderedElement.querySelector("#chatContainer");
    this.chatManager = new ChatManager(chatContainer, this.socketManager);

    this.game = new BombermanGame(this.socketManager, gameData);
    this.game.init();

    console.log("Game initialized with data:", gameData);
  }
} 