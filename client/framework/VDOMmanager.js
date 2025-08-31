// vdommanager.js
export class VDOMManager {
  constructor(container, renderFn, initialState = {}) {
    this.container = container;
    this.renderFn = renderFn;
    this.state = initialState;
    this.oldVNode = null;
    this.mounted = false;
    this.componentRefs = new Map(); // Store component references by key/id
    this.focusHandler = new FocusManager(this);
  }

  // Merge new state and re-render
  setState = (newState) => {
    this.state = { ...this.state, ...newState };
    if (!this.renderFn || !this.mounted) return;

    const newVNode = this.renderFn(this.state, this.setState);
    updateElement(this.container, newVNode, this.oldVNode, 0, this);
    this.oldVNode = newVNode;
  };

  // Initial mount
  mount(vnode = null) {
    if (this.mounted) {
      console.warn("VDOMManager already mounted");
      return;
    }

    this.container.innerHTML = "";

    if (vnode) {
      this.oldVNode = vnode;
      this.container.appendChild(createDOMNode(vnode, this));
    } else if (this.renderFn) {
      this.oldVNode = this.renderFn(this.state, this.setState);
      this.container.appendChild(createDOMNode(this.oldVNode, this));
    } else {
      throw new Error(
        "VDOMManager: mount() needs either a vnode or a renderFn"
      );
    }

    this.mounted = true;
  }

  unmount() {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.mounted = false;
    this.oldVNode = null;
    this.componentRefs.clear();
  }

  // Register a component reference
  registerRef(key, element) {
    if (key) {
      this.componentRefs.set(key, element);
    }
  }

  // Get a component reference
  getRef(key) {
    return this.componentRefs.get(key);
  }

  // Remove a component reference
  unregisterRef(key) {
    this.componentRefs.delete(key);
  }
}

// Focus management without getElementById
class FocusManager {
  constructor(vdomManager) {
    this.vdomManager = vdomManager;
    this.focusedElementKey = null;
    this.cursorPosition = 0;
  }

  preserveFocus(elementKey) {
    const element = this.vdomManager.getRef(elementKey);
    if (element && document.activeElement === element) {
      this.focusedElementKey = elementKey;
      this.cursorPosition = element.selectionStart || 0;
      return true;
    }
    return false;
  }

  restoreFocus() {
    if (this.focusedElementKey) {
      const element = this.vdomManager.getRef(this.focusedElementKey);
      if (element) {
        setTimeout(() => {
          element.focus();
          if (element.setSelectionRange) {
            element.setSelectionRange(this.cursorPosition, this.cursorPosition);
          }
        }, 0);
      }
      this.focusedElementKey = null;
      this.cursorPosition = 0;
    }
  }
}

// -------------------------
// VDOM diffing and patching
// -------------------------
function updateElement(parent, newVNode, oldVNode, index = 0, vdomManager) {
  const existingEl = parent.childNodes[index];

  // Remove node
  if (!newVNode && oldVNode) {
    if (existingEl) {
      // Unregister refs before removing
      if (oldVNode.attrs?.ref || oldVNode.attrs?.id) {
        const key = oldVNode.attrs.ref || oldVNode.attrs.id;
        vdomManager.unregisterRef(key);
      }
      parent.removeChild(existingEl);
    }
    return;
  }

  // Add node
  if (newVNode && !oldVNode) {
    parent.appendChild(createDOMNode(newVNode, vdomManager));
    return;
  }

  // Both null
  if (!newVNode && !oldVNode) return;

  // Replace if changed
  if (changed(newVNode, oldVNode)) {
    if (existingEl) {
      // Preserve focus if needed
      const shouldPreserveFocus = newVNode.attrs?.preserveFocus && 
        (newVNode.attrs?.ref || newVNode.attrs?.id);
      let focusPreserved = false;
      
      if (shouldPreserveFocus) {
        const key = newVNode.attrs.ref || newVNode.attrs.id;
        focusPreserved = vdomManager.focusHandler.preserveFocus(key);
      }

      // Unregister old refs
      if (oldVNode.attrs?.ref || oldVNode.attrs?.id) {
        const key = oldVNode.attrs.ref || oldVNode.attrs.id;
        vdomManager.unregisterRef(key);
      }

      parent.replaceChild(createDOMNode(newVNode, vdomManager), existingEl);
      
      if (focusPreserved) {
        vdomManager.focusHandler.restoreFocus();
      }
    } else {
      parent.appendChild(createDOMNode(newVNode, vdomManager));
    }
    return;
  }

  // Text node update
  if (typeof newVNode === "string") {
    if (existingEl && existingEl.textContent !== newVNode) {
      existingEl.textContent = newVNode;
    }
    return;
  }

  // Update attributes
  if (existingEl) {
    updateAttributes(existingEl, newVNode.attrs, oldVNode.attrs, vdomManager);

    const newChildren = newVNode.children || [];
    const oldChildren = oldVNode.children || [];
    reconcileKeyedChildren(existingEl, newChildren, oldChildren, vdomManager);
  }
}

// -------------------------
// Efficient keyed reconciliation
// -------------------------
function reconcileKeyedChildren(parentEl, newChildren, oldChildren, vdomManager) {
  const hasKeys =
    newChildren.some((c) => c?.attrs?.key != null) ||
    oldChildren.some((c) => c?.attrs?.key != null);

  // Simple index-based diffing if no keys
  if (!hasKeys) {
    const minLen = Math.min(newChildren.length, oldChildren.length);

    for (let i = 0; i < minLen; i++) {
      updateElement(parentEl, newChildren[i], oldChildren[i], i, vdomManager);
    }

    // Add new nodes
    for (let i = minLen; i < newChildren.length; i++) {
      updateElement(parentEl, newChildren[i], null, i, vdomManager);
    }

    // Remove surplus nodes
    for (let i = oldChildren.length - 1; i >= newChildren.length; i--) {
      const child = parentEl.childNodes[i];
      if (child && child.parentNode === parentEl) {
        // Unregister refs before removing
        if (oldChildren[i]?.attrs?.ref || oldChildren[i]?.attrs?.id) {
          const key = oldChildren[i].attrs.ref || oldChildren[i].attrs.id;
          vdomManager.unregisterRef(key);
        }
        parentEl.removeChild(child);
      }
    }
    return;
  }

  // Keyed reconciliation
  const oldKeyToElement = new Map();
  const oldKeyToVNode = new Map();

  oldChildren.forEach((child, idx) => {
    const key = child?.attrs?.key;
    if (key != null && parentEl.childNodes[idx]) {
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

      updateAttributes(el, newChild.attrs, oldVNode.attrs, vdomManager);
      reconcileKeyedChildren(
        el,
        newChild.children || [],
        oldVNode.children || [],
        vdomManager
      );

      newElements[idx] = el;
      usedKeys.add(key);
    } else {
      newElements[idx] = createDOMNode(newChild, vdomManager);
    }
  });

  // Remove unused old elements
  oldChildren.forEach((child, idx) => {
    const key = child?.attrs?.key;
    if (key != null && !usedKeys.has(key)) {
      // Unregister refs before removing
      if (child.attrs?.ref || child.attrs?.id) {
        const refKey = child.attrs.ref || child.attrs.id;
        vdomManager.unregisterRef(refKey);
      }
      
      const el = parentEl.childNodes[idx];
      if (el && el.parentNode === parentEl) {
        parentEl.removeChild(el);
      }
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
    const lastChild = parentEl.lastChild;
    if (lastChild) {
      parentEl.removeChild(lastChild);
    }
  }
}

function changed(node1, node2) {
  if (node1 == null || node2 == null) return node1 !== node2;
  if (typeof node1 !== typeof node2) return true;
  if (typeof node1 === "string") return node1 !== node2;
  return node1.tag !== node2.tag || node1.attrs?.key !== node2.attrs?.key;
}

function updateAttributes(el, newAttrs = {}, oldAttrs = {}, vdomManager) {
  if (!(el instanceof HTMLElement)) return; // skip text nodes

  // Handle focus preservation through the framework
  const shouldPreserveFocus = newAttrs.preserveFocus && 
    (newAttrs.ref || newAttrs.id) &&
    document.activeElement === el;
  
  let focusPreserved = false;
  if (shouldPreserveFocus) {
    const key = newAttrs.ref || newAttrs.id;
    focusPreserved = vdomManager.focusHandler.preserveFocus(key);
  }

  // Remove old attributes
  for (const key in oldAttrs) {
    if (!(key in newAttrs)) {
      if (key === "ref" || key === "id") {
        vdomManager.unregisterRef(oldAttrs[key]);
      } else if (key.startsWith("on")) {
        el[key] = null;
      } else {
        el.removeAttribute(key);
        if (key in el) el[key] = "";
      }
    }
  }

  // Set new attributes
  for (const [key, value] of Object.entries(newAttrs)) {
    if (key === "ref" || key === "id") {
      // Register component reference
      vdomManager.registerRef(value, el);
      if (key === "id") {
        el.setAttribute("id", value);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      el[key] = value;
    } else if (key === "disabled") {
      el.disabled = Boolean(value);
      if (!value) el.removeAttribute("disabled");
    } else if (key === "checked") {
      el.checked = Boolean(value);
      if (!value) el.removeAttribute("checked");
    } else if (key === "value" && el.tagName === "INPUT") {
      if (el.value !== value) {
        el.value = value;
        el.setAttribute("value", value);
      }
    } else if (key !== "preserveFocus" && oldAttrs[key] !== value) {
      el.setAttribute(key, value);
    }
  }

  // Restore focus if it was preserved
  if (focusPreserved) {
    vdomManager.focusHandler.restoreFocus();
  }
}

function createDOMNode(vnode, vdomManager) {
  if (vnode == null) return document.createTextNode("");
  if (typeof vnode === "string") return document.createTextNode(vnode);

  const el = document.createElement(vnode.tag);
  updateAttributes(el, vnode.attrs, {}, vdomManager);

  (vnode.children || []).forEach((child) => {
    if (child != null) {
      el.appendChild(createDOMNode(child, vdomManager));
    }
  });

  return el;
}