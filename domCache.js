// domCache.js
'use strict';

class DOMCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 5000;
    }

    get(key, selectorFn, validator = null) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            if (document.contains(cached.element)) {
                if (!validator || validator(cached.element)) {
                    return cached.element;
                }
            }
        }

        const element = selectorFn();
        if (element && (!validator || validator(element))) {
            this.cache.set(key, {
                element,
                timestamp: Date.now()
            });
            return element;
        }

        return null;
    }

    clear() {
        this.cache.clear();
    }

    invalidate(key) {
        this.cache.delete(key);
    }
}
