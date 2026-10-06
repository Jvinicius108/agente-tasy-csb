// debouncer.js
'use strict';

class Debouncer {
    constructor() {
        this.timeouts = new Map();
    }

    debounce(key, func, delay = CONSTANTES.TEMPOS.DEBOUNCE_CLICK) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }

        const timeout = setTimeout(() => {
            func();
            this.timeouts.delete(key);
        }, delay);

        this.timeouts.set(key, timeout);
    }

    clear(key) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        }
    }

    clearAll() {
        this.timeouts.forEach((timeout) => clearTimeout(timeout));
        this.timeouts.clear();
    }
}
