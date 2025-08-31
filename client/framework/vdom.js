export class VNode {
  constructor(tag, attrs = {}, children = []) {
    this.tag = tag.toLowerCase();
    this.attrs = attrs;
    this.children = children;
  }

  render() {
    const el = document.createElement(this.tag);
    for (const [key, value] of Object.entries(this.attrs)) {
      if (key.startsWith("on") && typeof value === "function") {
        el[key] = value; // attach handler as DOM property
      } else if (key === "value" && el.tagName === "INPUT") {
        el.value = value;
        el.setAttribute("value", value); // force attribute update
      } else if (key === "checked" && el.tagName === "INPUT") {
        el.checked = Boolean(value);
      } else if (key === "disabled" && (el.tagName === "BUTTON" || el.tagName === "INPUT")) {
        el.disabled = Boolean(value);
        if (!value) {
          el.removeAttribute("disabled"); // remove attribute if false
        }
      } else if (key !== "key") {
        el.setAttribute(key, value);
      }
    }


    this.children.forEach((child) => {
      if (child === null || child === undefined) return;
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child.render());
      }
    });

    return el;
  }
}
