// client/core/ChatManager.js
import {  VNode } from '../framework/vdom.js';
// import { VDOMManager } from '../framework/VDOMmanager.js';

export class ChatManager {
  // give it the container and the socket instance in the constructor
  constructor(container, socketManager) {
    this.container = container;
    this.socketManager = socketManager;
    this.init();
  }

  init() {
    this.messageLog = [];
    this.render();
  }

  render() {
    const messages = this.messageLog.map(msg => new VNode('div', { class: 'chat-message' }, [msg]));
    const vnode = new VNode('div', { class: 'chat' }, [
      new VNode('div', { id: 'messageLog', style: 'height: 300px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;' }, messages),
      new VNode('input', { id: 'chatInput', type: 'text', placeholder: 'Type your message...' }),
      new VNode('button', { onclick: () => this.handleSend() }, ['Send']),
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(vnode.render(vnode));
  }
  // when add msg render it and scroll to buttom for good ui
  addMessage(message) {
    this.messageLog.push(message);
    this.render();
    this.scrollToBottom();
  }
  // when send msg  ... bring the msg and send it to the server via sendChatMessage  then clear the input 
  handleSend() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    this.socketManager.sendChatMessage(msg);
    input.value = '';
  }

  scrollToBottom() {
    const log = this.container.querySelector('#messageLog');
    if (log) log.scrollTop = log.scrollHeight;
  }
}
