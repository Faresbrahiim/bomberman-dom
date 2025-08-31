import { VNode } from "../framework/vdom.js";
import { VDOMManager } from "../framework/VDOMmanager.js";
import { EventRegistry } from "../framework/eventhandler.js";
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
    this.gameData = null;
    this.eventRegistry = new EventRegistry();
    this.setupGlobalEventHandlers();

    this.vdom = new VDOMManager(this.container, this.render.bind(this), {
      currentView: "nickname",
      nicknameValue: "",
      errorMessage: "",
      playerCount: 1,
      countdownSeconds: null,
    });

    this.init();
  }

  setupGlobalEventHandlers() {
    document.addEventListener("keydown", (e) => {
      this.eventRegistry.dispatch("keydown", e);
    });

    document.addEventListener("keyup", (e) => {
      this.eventRegistry.dispatch("keyup", e);
    });
  }

  init() {
    this.vdom.mount();
  }

  render(state, setState) {
    switch (state.currentView) {
      case "nickname":
        return this.renderNicknameForm(state, setState);
      case "lobby":
        return this.renderLobby(state, setState);
      case "game":
        return this.renderGameLayout(state, setState);
      default:
        return new VNode("div", {}, ["Loading..."]);
    }
  }

  renderNicknameForm(state, setState) {
    return new VNode("div", { class: "nickname-form" }, [
      new VNode("h2", {}, ["Enter your nickname"]),
      new VNode("input", {
        id: "nicknameInput",
        type: "text",
        class: "nickname-input",
        placeholder: "Nickname (3-16 characters, letters/numbers/_)",
        maxlength: "16",
        value: state.nicknameValue,
        oninput: (e) => setState({ nicknameValue: e.target.value }),
        onkeydown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.handleJoin(setState);
          }
        },
        autofocus: true,
      }),
      new VNode(
        "button",
        {
          class: "join-btn",
          onclick: () => this.handleJoin(setState),
        },
        ["Join Lobby"]
      ),
      new VNode("p", { class: "error-msg" }, [state.errorMessage]),
    ]);
  }

  renderLobby(state, setState) {
    const countdownContent =
      state.countdownSeconds !== null
        ? state.countdownSeconds > 0
          ? [`Game starts in: ${state.countdownSeconds}s`]
          : ["Game Starting!"]
        : [];

    let playerCountText = `Players in lobby: ${state.playerCount}`;
    if (state.playerCount === 1) {
      playerCountText += " (Need at least 2 players to start)";
    } else if (state.playerCount >= 2 && state.playerCount < 4) {
      if (state.countdownSeconds === null) {
        playerCountText +=
          " (Game will start in 20 seconds, or when 4 players join)";
      }
    } else if (state.playerCount === 4) {
      playerCountText += " (Game starting in 10 seconds!)";
    }

    return new VNode("div", { class: "lobby" }, [
      new VNode("h2", {}, [`Welcome, ${this.nickname}!`]),
      new VNode("p", {}, ["Waiting for players to join..."]),
      new VNode("p", { class: "player-count" }, [playerCountText]),
      new VNode("div", { class: "countdown" }, [
        state.countdownSeconds !== null
          ? new VNode(
              "h3",
              {
                class:
                  state.countdownSeconds > 0
                    ? "countdown-timer"
                    : "countdown-start",
              },
              countdownContent
            )
          : null,
      ]),
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
  }

  handleJoin(setState) {
    const nickname = this.vdom.state.nicknameValue.trim();

    if (!nickname) {
      setState({ errorMessage: "Please enter a nickname." });
      return;
    }

    if (nickname.length < 3 || nickname.length > 16) {
      setState({ errorMessage: "Nickname must be 3-16 characters long." });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      setState({
        errorMessage:
          "Nickname can only contain letters, numbers, and underscores.",
      });
      return;
    }

    if (nickname.includes("<3")) {
      setState({ errorMessage: "Invalid nickname." });
      return;
    }

    this.nickname = nickname;
    setState({ errorMessage: "" });
    this.startSocket(setState);
  }

  startSocket(setState) {
    this.socketManager = new SocketManager(this.nickname);

    this.socketManager.on("connected", () => {
      setState({ currentView: "lobby" });
      this.initializeChatManager();
    });

    this.socketManager.on("playerCountUpdate", (count) => {
      setState({ playerCount: count });
    });

    this.socketManager.on("chatMessage", (msg) => {
      if (this.chatManager) this.chatManager.addMessage(msg);
    });

    this.socketManager.on("roomJoined", (roomId) => {
      this.roomId = roomId;
    });

    this.socketManager.on("countdownTick", (seconds) => {
      setState({ countdownSeconds: seconds });
    });

    this.socketManager.on("gameStart", (gameData) => {
      setState({ currentView: "game" });
      this.gameData = gameData;
    });

    this.socketManager.on("invalidNickname", (reason) => {
      setState({ errorMessage: reason });
    });

    this.socketManager.ws.onerror = () => {
      setState({
        errorMessage: "Failed to connect to server. Please try again.",
      });
    };
  }

  initializeChatManager() {
    setTimeout(() => {
      const chatContainer = document.getElementById("chatContainer");
      if (chatContainer) {
        this.chatManager = new ChatManager(
          chatContainer,
          this.socketManager,
          this.eventRegistry
        );
      }
    }, 100);
  }

  initializeGame() {
    const chatContainer = document.getElementById("chatContainer");
    if (chatContainer) {
      this.chatManager = new ChatManager(
        chatContainer,
        this.socketManager,
        this.eventRegistry
      );
    }

    this.game = new BombermanGame(
      this.socketManager,
      this.gameData,
      this.eventRegistry
    );
    this.game.chatManager = this.chatManager;
    this.game.init();
  }
  renderGameLayout(state, setState) {
    this.initializeGame();
    return new VNode("div", { class: "game-layout" }, [
      new VNode("div", { class: "game-area" }, [
        new VNode("div", { class: "banner" }, [
          new VNode("img", {
            src: "../media/baner.png",
            alt: "Bomberman Banner",
          }),
        ]),
        new VNode(
          "div",
          { id: "gameMapContainer", class: "map-container" },
          this.gameData ? [this.game.render()] : []
        ),
      ]),
      new VNode("div", { id: "chatContainer", class: "chat-container" }),
    ]);
  }
}
