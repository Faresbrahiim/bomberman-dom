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
    this.oldCountdownVNode = null;
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
    const rendered = vnode.render();
    this.container.appendChild(rendered);

    this.nicknameInput = rendered.querySelector("#nicknameInput");
    this.errorMsgEl = rendered.querySelector("#errorMsg");

    if (this.nicknameInput) {
      this.nicknameInput.focus();
      this.nicknameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleJoin();
      });
    }
  }

  handleJoin() {
    if (!this.nicknameInput || !this.errorMsgEl) return;
    const nickname = this.nicknameInput.value.trim();

    if (!nickname) return (this.errorMsgEl.textContent = "Please enter a nickname.");
    if (nickname.length < 3 || nickname.length > 16)
      return (this.errorMsgEl.textContent = "Nickname must be 3-16 characters long.");
    if (!/^[a-zA-Z0-9_]+$/.test(nickname))
      return (this.errorMsgEl.textContent = "Nickname can only contain letters, numbers, and underscores.");
    if (nickname.includes("<3")) return (this.errorMsgEl.textContent = "Invalid nickname.");

    this.nickname = nickname;
    this.startSocket();
  }

  startSocket() {
    this.socketManager = new SocketManager(this.nickname);

    this.socketManager.on("connected", () => this.renderLobby());
    this.socketManager.on("playerCountUpdate", (count) => this.updatePlayerCount(count));
    this.socketManager.on("chatMessage", (msg) => this.chatManager?.addMessage(msg));
    this.socketManager.on("roomJoined", (roomId) => (this.roomId = roomId));
    this.socketManager.on("countdownTick", (seconds) => this.renderCountdown(seconds));
    this.socketManager.on("gameStart", (data) => this.renderGame(data));
    this.socketManager.on("invalidNickname", (reason) => this.errorMsgEl && (this.errorMsgEl.textContent = reason));
    this.socketManager.ws.onerror = () => this.errorMsgEl && (this.errorMsgEl.textContent = "Failed to connect to server. Please try again.");
  }

  renderLobby() {
    const vnode = new VNode("div", { class: "lobby" }, [
      new VNode("h2", {}, [`Welcome, ${this.nickname}!`]),
      new VNode("p", {}, ["Waiting for players to join..."]),
      new VNode("p", { id: "playerCount", class: "player-count" }, ["Players in lobby: 1"]),
      new VNode("div", { id: "countdown", class: "countdown" }, []),
      new VNode("div", { class: "rules-box" }, [
        new VNode("h3", {}, ["Game Rules:"]),
        new VNode("ul", {}, [
          new VNode("li", {}, ["Move: WASD or Arrow Keys"]),
          new VNode("li", {}, ["Place Bomb: Spacebar"]),
          new VNode("li", {}, ["Collect powerups to increase bombs, flames, and speed"]),
          new VNode("li", {}, ["Last player standing wins!"]),
        ]),
      ]),
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
    ]);

    this.container.innerHTML = "";
    const rendered = vnode.render();
    this.container.appendChild(rendered);

    this.playerCountEl = rendered.querySelector("#playerCount");
    this.countdownContainer = rendered.querySelector("#countdown");
    this.chatManager = new ChatManager(rendered.querySelector("#chatContainer"), this.socketManager);
  }

  updatePlayerCount(count) {
    if (!this.playerCountEl) return;

    let text = `Players in lobby: ${count}`;
    if (count === 1) text += " (Need at least 2 players to start)";
    else if (count >= 2 && count < 4 && this.countdownSeconds === null)
      text += " (Game will start in 20 seconds, or when 4 players join)";
    else if (count === 4) text += " (Game starting in 10 seconds!)";

    this.playerCountEl.textContent = text;
  }

  renderCountdown(seconds) {
    if (!this.countdownContainer) return;

    const countdownVNode = new VNode("div", { id: "countdown" }, [
      seconds > 0
        ? new VNode("h3", { class: "countdown-timer" }, [`Game starts in: ${seconds}s`])
        : new VNode("h3", { class: "countdown-start" }, ["Game Starting!"]),
    ]);

    updateElement(this.countdownContainer, countdownVNode, this.oldCountdownVNode);
    this.oldCountdownVNode = countdownVNode;
    this.countdownSeconds = seconds;
  }

  renderGame(gameData) {
    const gameLayout = new VNode("div", { class: "game-layout" }, [
      new VNode("div", { class: "game-area" }, [
        new VNode("div", { class: "banner" }, [
          new VNode("img", { src: "../media/baner.png", alt: "notFound" }),
        ]),
        new VNode("div", { id: "gameMapContainer", class: "map-container" }),
        new VNode("div", { id: "playerStatusArea", class: "status-container" }),
      ]),
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
    ]);

    this.container.innerHTML = "";
    const renderedElement = gameLayout.render();
    this.container.appendChild(renderedElement);

    this.mapContainer = renderedElement.querySelector("#gameMapContainer");
    const chatContainer = renderedElement.querySelector("#chatContainer");
    this.chatManager = new ChatManager(chatContainer, this.socketManager);

    this.game = new BombermanGame(this.socketManager, gameData, this.mapContainer);
    this.game.init();
  }

  showSpectatorMessage() {
    if (!this.mapContainer) return;
    if (this.mapContainer.querySelector("#spectatorOverlay")) return;

    const overlayVNode = new VNode("div", { id: "spectatorOverlay", class: "spectator-overlay" }, [
      new VNode("div", { class: "spectator-message" }, [
        new VNode("h3", {}, ["SPECTATOR MODE"]),
        new VNode("p", {}, ["You have been eliminated. Watch the remaining players!"]),
      ]),
    ]);

    this.mapContainer.appendChild(overlayVNode.render());
  }
}
