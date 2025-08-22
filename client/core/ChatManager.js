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
  }

  render(state, setState) {
    const messages = state.messages.map((msg, i) =>
      new VNode("div", { class: "chat-message", key: i }, [msg])
    );

    return new VNode("div", { class: "chat" }, [
      new VNode("div", {
        id: "messageLog",
        style:
          "height:300px; overflow-y:auto; border:1px solid #ccc; padding:5px;",
      }, messages),
      new VNode("input", {
        id: "chatInput",
        type: "text",
        placeholder: "Type your message...",
      }),
      new VNode("button", { onclick: () => this.handleSend(setState) }, [
        "Send",
      ]),
    ]);
  }

  addMessage(message) {
    this.vdom.setState({
      messages: [...this.vdom.state.messages, message],
    });
    setTimeout(() => this.scrollToBottom(), 0);
  }

  handleSend(setState) {
    const input = document.getElementById("chatInput");
    const msg = input.value.trim();
    if (!msg) return;

    this.socketManager.sendChatMessage(msg);
    input.value = "";
  }

  scrollToBottom() {
    const log = this.container.querySelector("#messageLog");
    if (log) log.scrollTop = log.scrollHeight;
  }
}
