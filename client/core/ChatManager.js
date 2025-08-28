import { VNode } from "../framework/vdom.js";
import { VDOMManager } from "../framework/VDOMmanager.js";

export class ChatManager {
  constructor(container, socketManager) {
    this.container = container;
    this.socketManager = socketManager;

    this.vdom = new VDOMManager(
      this.container,
      this.render.bind(this),
      { messages: [] }
    );
    this.vdom.mount();

    this.setupEventListeners();
  }

  render(state, setState) {
    const messages = state.messages.map((message, index) => {
      const isSystem = message.includes(" * ");
      const isOwn =
        this.socketManager &&
        this.socketManager.nickname &&
        message.includes(`${this.socketManager.nickname}:`);

      // Use speech-bubble instead of chat-message for cute pixel art style! 🎮
      let className = "speech-bubble";
      if (isSystem) className += " system";
      if (isOwn) className += " own";

      return new VNode("div", { class: className, key: index }, [message]);
    });

    return new VNode("div", { class: "chat-container" }, [
      new VNode("div", { class: "chat-header" }, [
        new VNode("h3", {}, ["💬 Chat"]), // Added cute emoji
      ]),
      new VNode("div", { id: "chatMessages", class: "chat-messages" }, messages),
      new VNode("div", { class: "chat-input-container" }, [
        new VNode("input", {
          id: "chatInput",
          type: "text",
          class: "chat-input",
          placeholder: "Type your cute message... ✨",
          maxlength: "200"
        }),
        new VNode("button", {
          id: "chatSend",
          class: "chat-send",
          onclick: () => this.sendMessage(setState)
        }, ["Send! 💫"])
      ])
    ]);
  }

  setupEventListeners() {
    const input = document.getElementById("chatInput");

    // Focus chat when Enter is pressed (if not already typing)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (document.activeElement !== input) {
          e.preventDefault();
          input.focus();
        } else {
          e.preventDefault();
          this.sendMessage(this.vdom.setState.bind(this.vdom));
          input.blur(); // leave chat → back to game
        }
      }
    });
  }


  sendMessage(setState) {
    const input = document.getElementById("chatInput");
    if (!input) return;
    const message = input.value.trim();

    if (message.length > 0) {
      this.socketManager.sendChatMessage(message);
      input.value = "";
    }
  }

  addMessage(messageText) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const messageWithTime = `[${timestamp}] ${messageText}`;

    this.vdom.setState({
      messages: [...this.vdom.state.messages, messageWithTime].slice(-100),
    });

    setTimeout(() => this.scrollToBottom(), 0);
  }

  addSystemMessage(messageText) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const systemMessage = `[${timestamp}] * ${messageText}`;

    this.vdom.setState({
      messages: [...this.vdom.state.messages, systemMessage].slice(-100),
    });

    setTimeout(() => this.scrollToBottom(), 0);
  }

  notifyPlayerJoined(playerName) {
    this.addSystemMessage(`🎮 ${playerName} joined the game`);
  }

  notifyPlayerLeft(playerName) {
    this.addSystemMessage(`👋 ${playerName} left the game`);
  }

  notifyGameStart() {
    this.addSystemMessage("🚀 Game started! Good luck!");
  }

  notifyPlayerDied(playerName, livesLeft) {
    if (livesLeft > 0) {
      this.addSystemMessage(
        `💥 ${playerName} was eliminated! ${livesLeft} lives remaining`
      );
    } else {
      this.addSystemMessage(`☠️ ${playerName} is out of the game!`);
    }
  }

  clear() {
    this.vdom.setState({ messages: [] });
  }

  scrollToBottom() {
    const log = this.container.querySelector("#chatMessages");
    if (log) log.scrollTop = log.scrollHeight;
  }
}