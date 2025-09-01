// =============================================================================
// STEP 1: IMPORTS (EXECUTED FIRST - MODULE LOADING)
// =============================================================================
import { VNode } from "../framework/vdom.js";
import { VDOMManager } from "../framework/VDOMmanager.js";

// =============================================================================
// STEP 2: CLASS DEFINITION (EXECUTED SECOND - CLASS BLUEPRINT CREATION)
// =============================================================================
export class ChatManager {
  // =============================================================================
  // STEP 3: CONSTRUCTOR (EXECUTED THIRD - INSTANCE INITIALIZATION)
  // =============================================================================
  constructor(container, socketManager) {
    // Store references to DOM container and socket communication manager
    this.container = container;
    this.socketManager = socketManager;

    // Initialize Virtual DOM manager with initial state and render method binding
    this.vdom = new VDOMManager(
      this.container,
      this.render.bind(this),
      { messages: [] }
    );
    // Mount the VDOM to start rendering cycle
    this.vdom.mount();
  }

  // =============================================================================
  // STEP 4: RENDER METHOD (EXECUTED ON STATE CHANGES - UI GENERATION)
  // =============================================================================
  render(state, setState) {
    // Transform messages array into VNode elements with styling logic
    const messages = state.messages.map((message, index) => {
      // Determine message type based on content patterns
      const isSystem = message.includes(" * ");
      const isOwn =
        this.socketManager &&
        this.socketManager.nickname &&
        message.includes(`${this.socketManager.nickname}:`);

      // Apply CSS classes based on message type for visual styling
      // Use speech-bubble instead of chat-message for cute pixel art style! 🎮
      let className = "speech-bubble";
      if (isSystem) className += " system";
      if (isOwn) className += " own";

      // Return VNode representation of each message
      return new VNode("div", { class: className, key: index }, [message]);
    });

    // Return complete chat interface VNode structure
    return new VNode("div", { class: "chat-container" }, [
      // Chat header with title
      new VNode("div", { class: "chat-header" }, [
        new VNode("h3", {}, ["💬 Chat"]),
      ]),
      // Messages display area
      new VNode("div", { id: "chatMessages", class: "chat-messages" }, messages),
      // Input controls container
      new VNode("div", { class: "chat-input-container" }, [
        // Text input with Enter key handling
        new VNode("input", {
          id: "chatInput",
          type: "text",
          class: "chat-input",
          placeholder: "Type your cute message... ✨",
          maxlength: "200",
          onkeydown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              this.sendMessage(setState); // send message
              e.target.focus(); // keep input focused
            }
          }
        }),

        // Send button with click handler
        new VNode("button", {
          id: "chatSend",
          class: "chat-send",
          onclick: () => this.sendMessage(setState)
        }, ["Send! 💫"])
      ])
    ]);

  }

  // =============================================================================
  // STEP 5: MESSAGE SENDING (EXECUTED ON USER ACTION - OUTBOUND COMMUNICATION)
  // =============================================================================
  sendMessage(setState) {
    // Get reference to input element from DOM
    const input = document.getElementById("chatInput");
    if (!input) return;
    const message = input.value.trim();

    // Validate message content and send via socket if valid
    if (message.length > 0) {
      this.socketManager.sendChatMessage(message);
      input.value = "";
    }
  }

  // =============================================================================
  // STEP 6: MESSAGE ADDITION (EXECUTED ON INCOMING DATA - INBOUND COMMUNICATION)
  // =============================================================================
  addMessage(messageText) {
    // Generate timestamp for message display
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const messageWithTime = `[${timestamp}] ${messageText}`;

    // Update VDOM state with new message, keeping only last 100 messages
    this.vdom.setState({
      messages: [...this.vdom.state.messages, messageWithTime].slice(-100),
    });

    // Auto-scroll to bottom after DOM update
    setTimeout(() => this.scrollToBottom(), 0);
  }

  // =============================================================================
  // STEP 7: SYSTEM MESSAGE ADDITION (EXECUTED ON SYSTEM EVENTS - AUTOMATED COMMUNICATION)
  // =============================================================================
  addSystemMessage(messageText) {
    // Generate timestamp for system message display
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const systemMessage = `[${timestamp}] * ${messageText}`;

    // Update VDOM state with system message, keeping only last 100 messages
    this.vdom.setState({
      messages: [...this.vdom.state.messages, systemMessage].slice(-100),
    });

    // Auto-scroll to bottom after DOM update
    setTimeout(() => this.scrollToBottom(), 0);
  }

  // =============================================================================
  // STEP 8: GAME EVENT NOTIFICATION METHODS (EXECUTED ON GAME EVENTS - STATUS UPDATES)
  // =============================================================================
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
    // Display different messages based on remaining lives
    if (livesLeft > 0) {
      this.addSystemMessage(
        `💥 ${playerName} was eliminated! ${livesLeft} lives remaining`
      );
    } else {
      this.addSystemMessage(`☠️ ${playerName} is out of the game!`);
    }
  }

  // =============================================================================
  // STEP 9: UTILITY METHODS (EXECUTED ON DEMAND - HELPER FUNCTIONS)
  // =============================================================================
  clear() {
    // Reset chat state to empty messages array
    this.vdom.setState({ messages: [] });
  }

  scrollToBottom() {
    // Find chat messages container and scroll to bottom
    const log = this.container.querySelector("#chatMessages");
    if (log) log.scrollTop = log.scrollHeight;
  }
}