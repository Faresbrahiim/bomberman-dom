// client/core/ChatManager.js

export class ChatManager {
  constructor(container, socketManager) {
      this.container = container;
      this.socketManager = socketManager;
      this.messages = [];
      this.init();
  }

  init() {
      this.render();
      this.setupEventListeners();
  }

  render() {
      this.container.innerHTML = `
          <div class="chat-header">
              <h3>Chat</h3>
          </div>
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input-container">
              <input type="text" class="chat-input" id="chatInput" placeholder="Type a message..." maxlength="200">
              <button class="chat-send" id="chatSend">Send</button>
          </div>
      `;

      // Apply styles
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.height = '100%';

      const header = this.container.querySelector('.chat-header');
      header.style.padding = '10px';
      header.style.borderBottom = '1px solid #ddd';
      header.style.backgroundColor = '#f5f5f5';
      header.style.margin = '-15px -15px 10px -15px';
      header.style.borderRadius = '10px 10px 0 0';

      const messagesContainer = this.container.querySelector('.chat-messages');
      messagesContainer.style.flex = '1';
      messagesContainer.style.overflowY = 'auto';
      messagesContainer.style.padding = '10px';
      messagesContainer.style.backgroundColor = '#fafafa';
      messagesContainer.style.border = '1px solid #ddd';
      messagesContainer.style.borderRadius = '5px';
      messagesContainer.style.marginBottom = '10px';
      messagesContainer.style.fontSize = '14px';
      messagesContainer.style.lineHeight = '1.5';

      // Render existing messages
      this.renderMessages();
  }

  setupEventListeners() {
      const input = this.container.querySelector('#chatInput');
      const button = this.container.querySelector('#chatSend');

      // Send message on button click
      button.addEventListener('click', () => {
          this.sendMessage();
      });

      // Send message on Enter key
      input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              this.sendMessage();
          }
      });

      // Focus input when typing
      document.addEventListener('keydown', (e) => {
          // Only focus if we're not already typing in an input and it's a letter/number
          if (!document.activeElement.matches('input, textarea') && 
              /^[a-zA-Z0-9]$/.test(e.key)) {
              input.focus();
          }
      });
  }

  sendMessage() {
      const input = this.container.querySelector('#chatInput');
      const message = input.value.trim();

      if (message && message.length > 0) {
          // Send to server
          this.socketManager.sendChatMessage(message);
          
          // Clear input
          input.value = '';
      }
  }

  addMessage(messageText) {
      // Add timestamp
      const timestamp = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
      });
      
      const messageWithTime = `[${timestamp}] ${messageText}`;
      this.messages.push(messageWithTime);

      // Keep only last 100 messages
      if (this.messages.length > 100) {
          this.messages.shift();
      }

      this.renderMessages();
  }

  addSystemMessage(messageText) {
      const timestamp = new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
      });
      
      const systemMessage = `[${timestamp}] * ${messageText}`;
      this.messages.push(systemMessage);

      if (this.messages.length > 100) {
          this.messages.shift();
      }

      this.renderMessages();
  }

  renderMessages() {
      const messagesContainer = this.container.querySelector('#chatMessages');
      if (!messagesContainer) return;

      messagesContainer.innerHTML = '';

      this.messages.forEach((message, index) => {
          const messageDiv = document.createElement('div');
          messageDiv.style.marginBottom = '5px';
          messageDiv.style.wordWrap = 'break-word';
          
          // Style system messages differently
          if (message.includes(' * ')) {
              messageDiv.style.color = '#666';
              messageDiv.style.fontStyle = 'italic';
          }
          
          // Highlight own messages (basic detection)
          if (this.socketManager && this.socketManager.nickname && 
              message.includes(`${this.socketManager.nickname}:`)) {
              messageDiv.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
              messageDiv.style.padding = '2px 5px';
              messageDiv.style.borderRadius = '3px';
          }

          messageDiv.textContent = message;
          messagesContainer.appendChild(messageDiv);
      });

      // Auto-scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Method to add system notifications
  notifyPlayerJoined(playerName) {
      this.addSystemMessage(`${playerName} joined the game`);
  }

  notifyPlayerLeft(playerName) {
      this.addSystemMessage(`${playerName} left the game`);
  }

  notifyGameStart() {
      this.addSystemMessage(`Game started! Good luck!`);
  }

  notifyPlayerDied(playerName, livesLeft) {
      if (livesLeft > 0) {
          this.addSystemMessage(`${playerName} was eliminated! ${livesLeft} lives remaining`);
      } else {
          this.addSystemMessage(`${playerName} is out of the game!`);
      }
  }

  clear() {
      this.messages = [];
      this.renderMessages();
  }
}