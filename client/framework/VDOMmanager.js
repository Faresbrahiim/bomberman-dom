// enigne or  the framework 
export class VDOMManager {
  constructor(container, renderFn, initialState = {}) {
    this.container = container; // the container where the app will render ...
    this.renderFn = renderFn;  // contains the -> new node etc..
    this.state = initialState; // the initial state 
    this.oldVNode = null; // oldvnode -> sometimes will be null other time will be node -> keeps track of the vdom -> when set state is calling we use diffing 
  }

  // Merge new state and re-render
  setState = (newState) => {
    // combine prv state with current one  ,, spread opetator to merge the  objct 
    this.state = { ...this.state, ...newState };
    // give it set state func so render func can use  it  + the updated state -> old + new
    // when state is modified -> it called setstate again to update shit
    const newVNode = this.renderFn(this.state, this.setState);
    //  container -> which is the element -> the  new node +  the old node -> firt time old will be nulll 
    updateElement(this.container, newVNode, this.oldVNode);
    // when updating happened -> the oldnode becoms the new node ... etc
    this.oldVNode = newVNode;
  };

  // Initial mount
  // calls rendeer with the initial state 
  mount() {
    this.oldVNode = this.renderFn(this.state, this.setState);
    // render it ..
    this.container.appendChild(this.oldVNode.render());
  }
}

// -------------------------
// VDOM diffing and patching
// -------------------------
// parent dom contianer
function updateElement(parent, newVNode, oldVNode, index = 0) {
  const existingEl = parent.childNodes[index];

  // Remove node
  // newVNode → there is no new virtual node at this position after re-render , but old  node exist ... case of removing node
  // oldVNode → there was a virtual node here in the previous render.
  if (!newVNode && oldVNode) {
    if (existingEl) parent.removeChild(existingEl);
    return;
  }

  // Add node
  // new node exist .. olf node does not exist ... case of creating node
  
  if (newVNode && !oldVNode) {
    parent.appendChild(createDOMNode(newVNode));
    return;
  }

  // Both null
  //  nothing to update
  if (!newVNode && !oldVNode) return;

  // Replace if changed
  if (changed(newVNode, oldVNode)) {
    // create the new node since it chande ,,, then replace it ,, in the parent elemnt ,,,
    parent.replaceChild(createDOMNode(newVNode), existingEl);
    return;
  }

  // Text node update
  // not object just string ,,,...
  if (typeof newVNode === "string") {
    if (existingEl.textContent !== newVNode) existingEl.textContent = newVNode;
    return;
  }

  // Update attributes
  updateAttributes(existingEl, newVNode.attrs, oldVNode.attrs);

  const newChildren = newVNode.children || [];
  const oldChildren = oldVNode.children || [];

  reconcileKeyedChildren(existingEl, newChildren, oldChildren);
}

// -------------------------
// Efficient keyed reconciliation
// -------------------------
function reconcileKeyedChildren(parentEl, newChildren, oldChildren) {
  const hasKeys =
    newChildren.some(c => c?.attrs?.key != null) ||
    oldChildren.some(c => c?.attrs?.key != null);

  // Simple index-based diffing if no keys
  if (!hasKeys) {
    const minLen = Math.min(newChildren.length, oldChildren.length);

    for (let i = 0; i < minLen; i++) {
      updateElement(parentEl, newChildren[i], oldChildren[i], i);
    }

    // Add new nodes
    for (let i = minLen; i < newChildren.length; i++) {
      updateElement(parentEl, newChildren[i], null, i);
    }

    // Remove surplus nodes
    for (let i = oldChildren.length - 1; i >= newChildren.length; i--) {
      const child = parentEl.childNodes[i];
      if (child) parentEl.removeChild(child);
    }
    return;
  }

  // Keyed reconciliation
  const oldKeyToElement = new Map();
  const oldKeyToVNode = new Map();

  oldChildren.forEach((child, idx) => {
    const key = child?.attrs?.key;
    if (key != null) {
      oldKeyToElement.set(key, parentEl.childNodes[idx]);
      oldKeyToVNode.set(key, child);
    }
  });

  const newElements = [];
  const usedKeys = new Set();

  newChildren.forEach((newChild, idx) => {
    const key = newChild?.attrs?.key;

    if (key != null && oldKeyToElement.has(key)) {
      const el = oldKeyToElement.get(key);
      const oldVNode = oldKeyToVNode.get(key);

      updateAttributes(el, newChild.attrs, oldVNode.attrs);
      reconcileKeyedChildren(el, newChild.children || [], oldVNode.children || []);

      newElements[idx] = el;
      usedKeys.add(key);
    } else {
      newElements[idx] = createDOMNode(newChild);
    }
  });

  // Remove unused old elements
  oldChildren.forEach((child, idx) => {
    const key = child?.attrs?.key;
    if (key != null && !usedKeys.has(key)) {
      const el = parentEl.childNodes[idx];
      if (el && el.parentNode === parentEl) parentEl.removeChild(el);
    }
  });

  // Reorder / insert elements
  newElements.forEach((el, idx) => {
    const currentEl = parentEl.childNodes[idx];
    if (currentEl !== el) {
      if (el.parentNode === parentEl) {
        parentEl.insertBefore(el, currentEl || null);
      } else {
        parentEl.insertBefore(el, currentEl || null);
      }
    }
  });

  // Remove extra children
  while (parentEl.childNodes.length > newChildren.length) {
    parentEl.removeChild(parentEl.lastChild);
  }
}


function changed(node1, node2) {
  //  null null -> return false nothing changed
  if (node1 == null || node2 == null) return node1 !== node2;
  // string object ,,,, different type -> true -> changed
  if (typeof node1 !== typeof node2) return true;
  // check value -> input..
  if (typeof node1 === "string") return node1 !== node2; // retur true if there no equal
  // if node1 and not 2 not string type ,
  return node1.tag !== node2.tag || node1.attrs?.key !== node2.attrs?.key; // key if exist ...
}

function updateAttributes(el, newAttrs = {}, oldAttrs = {}) {
  // itearate over old attrb on the v dom
  // if one key does not exist in new att ..-> remove ir from element 
  for (const key in oldAttrs) {
    if (!(key in newAttrs)) {
      el.removeAttribute(key);
      // clear property also ,,, for value disabled etc...
      if (key in el) el[key] = "";
    }
  }
  // same as the one in the render...
  for (const [key, value] of Object.entries(newAttrs)) {
    if (key.startsWith("on") && typeof value === "function") {
      // set the property
      el[key] = value;
    } else if (key === "disabled") {
      // set property
      el.disabled = Boolean(value);
      if (!value) el.removeAttribute("disabled");
    } else if (key === "checked") {
      el.checked = Boolean(value);
      if (!value) el.removeAttribute("checked");
    } else if (key === "value" && el.tagName === "INPUT") {
      el.value = value;
      el.setAttribute("value", value);
    } else {
      el.setAttribute(key, value);
    }
  }
}

function createDOMNode(vnode) {
  if (vnode == null) return document.createTextNode(""); // checking  .. if nul create empty node
  if (typeof vnode === "string") return document.createTextNode(vnode); // if it's string .-> create node text
  // if not -> means it's real node
  const el = document.createElement(vnode.tag); // create tag 
  updateAttributes(el, vnode.attrs, {}); // set attrb from the v dom to the real dom
  // do it again recursevly
  // append rfs in  the element ....
  (vnode.children || []).forEach(child => {
    el.appendChild(createDOMNode(child));
  });
  // return the element with children
  return el;
}
