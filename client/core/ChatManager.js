import { VNode } from "../framework/vdom.js";
import { VDOMManager } from "../framework/VDOMmanager.js";

export class ChatManager {
  constructor(container, socketManager, eventRegistry) {
    this.container = container;
    this.socketManager = socketManager;
    this.eventRegistry = eventRegistry;
    this.inputRef = null;

    this.vdom = new VDOMManager(
      this.container,
      this.render.bind(this),
      { messages: [], inputValue: "" }
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

      let className = "speech-bubble";
      if (isSystem) className += " system";
      if (isOwn) className += " own";

      return new VNode("div", { class: className, key: index }, [message]);
    });

    return new VNode("div", { class: "chat-container" }, [
      new VNode("div", { class: "chat-header" }, [
        new VNode("h3", {}, ["Chat"]),
      ]),
      new VNode("div", { 
        id: "chatMessages", 
        class: "chat-messages",
        key: "chat-messages-container"
      }, messages),
      new VNode("div", { class: "chat-input-container" }, [
        new VNode("input", {
          id: "chatInput",
          type: "text",
          class: "chat-input",
          placeholder: "Type your message...",
          maxlength: "200",
          value: state.inputValue,
          key: "chat-input-key",
          oninput: (e) => {
            const cursorPos = e.target.selectionStart;
            setState({ inputValue: e.target.value });
            
            setTimeout(() => {
              const input = document.getElementById("chatInput");
              if (input && document.activeElement !== input) {
                input.focus();
                input.setSelectionRange(cursorPos, cursorPos);
              }
            }, 1);
          },
          onkeydown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              this.sendMessage(setState);
            }
          }
        }),
        new VNode("button", {
          class: "chat-send",
          onclick: () => this.sendMessage(setState)
        }, ["Send"])
      ])
    ]);
  }

  setupEventListeners() {
    this.eventRegistry.subscribe("keydown", (e) => {
      const chatInput = document.getElementById("chatInput");
      const activeElement = document.activeElement;
      
      if (e.key === "Enter" && activeElement !== chatInput) {
        e.preventDefault();
        e.stopPropagation();
        if (chatInput) {
          chatInput.focus();
        }
      }
    });
  }

  sendMessage(setState) {
    const currentValue = this.vdom.state.inputValue.trim();

    if (currentValue.length > 0) {
      this.socketManager.sendChatMessage(currentValue);
      setState({ inputValue: "" });
      
      setTimeout(() => {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
          chatInput.focus();
        }
      }, 1);
    }
  }

  addMessage(messageText) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const messageWithTime = `[${timestamp}] ${messageText}`;

    const wasFocused = document.activeElement && document.activeElement.id === "chatInput";
    const cursorPos = wasFocused ? document.activeElement.selectionStart : 0;

    this.vdom.setState({
      messages: [...this.vdom.state.messages, messageWithTime].slice(-100),
    });

    if (wasFocused) {
      setTimeout(() => {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
          chatInput.focus();
          chatInput.setSelectionRange(cursorPos, cursorPos);
        }
      }, 1);
    }

    setTimeout(() => this.scrollToBottom(), 0);
  }

  addSystemMessage(messageText) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const systemMessage = `[${timestamp}] * ${messageText}`;

    const wasFocused = document.activeElement && document.activeElement.id === "chatInput";
    const cursorPos = wasFocused ? document.activeElement.selectionStart : 0;

    this.vdom.setState({
      messages: [...this.vdom.state.messages, systemMessage].slice(-100),
    });

    if (wasFocused) {
      setTimeout(() => {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) {
          chatInput.focus();
          chatInput.setSelectionRange(cursorPos, cursorPos);
        }
      }, 1);
    }

    setTimeout(() => this.scrollToBottom(), 0);
  }

  notifyPlayerJoined(playerName) {
    this.addSystemMessage(`${playerName} joined the game`);
  }

  notifyPlayerLeft(playerName) {
    this.addSystemMessage(`${playerName} left the game`);
  }

  notifyGameStart() {
    this.addSystemMessage("Game started! Good luck!");
  }

  notifyPlayerDied(playerName, livesLeft) {
    if (livesLeft > 0) {
      this.addSystemMessage(
        `${playerName} was eliminated! ${livesLeft} lives remaining`
      );
    } else {
      this.addSystemMessage(`${playerName} is out of the game!`);
    }
  }

  clear() {
    this.vdom.setState({ messages: [], inputValue: "" });
  }

  scrollToBottom() {
    const log = this.container.querySelector("#chatMessages");
    if (log) log.scrollTop = log.scrollHeight;
  }
}