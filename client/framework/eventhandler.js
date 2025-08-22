export class EventRegistry {
    constructor() {
        this.listeners = new Map();
    }
    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
        this.listeners.get(eventType).add(callback);
        return () => this.listeners.get(eventType).delete(callback);
    }

    dispatch(eventType, payload) {
        const cbs = this.listeners.get(eventType);
        if (cbs) {
            for (const cb of cbs) cb(payload);
        }
    }
}
