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
        el.value = value; // property + live
        el.setAttribute("value", value); // not like  first render 
        //Because checked works exactly like value → it has both an attribute and a property, but the property is what really controls the box state.
      } else if (key === "checked" && el.tagName === "INPUT") {
        el.checked = Boolean(value);
      } else if (key === "disabled" && (el.tagName === "BUTTON" || el.tagName === "INPUT")) {
        // set it to true or false -> property
        el.disabled = Boolean(value);
        // ila kant false removeha
        if (!value) {
          el.removeAttribute("disabled"); // remove attribute if false
        }
        // ignore key -> because we'll use it in diffing
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
