// errorHandler.js
'use strict';

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    log(error, contexto = '') {
        const timestamp = new Date().toISOString();
        const errorObj = {
            timestamp,
            message: error?.message || String(error),
            stack: error?.stack || '',
            contexto,
            userAgent: navigator.userAgent
        };

        this.errors.push(errorObj);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        console.error(`[${timestamp}] ${contexto}:`, error);
        return errorObj;
    }

    getErrors() {
        return [...this.errors];
    }

    exportar() {
        const blob = new Blob([JSON.stringify(this.errors, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `erros_agente_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    clear() {
        this.errors = [];
    }
}
