// securityUtils.js
'use strict';

const SecurityUtils = {
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    sanitizeText(text) {
        if (!text) return '';
        return String(text)
            .replace(/[<>'"]/g, '')
            .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
            .trim();
    },

    // NOVO: normalização robusta para comparação de descrições do TASY.
    //  - .normalize('NFD') decompõe "é" (U+00E9) em "e" + "◌́" (U+0065 U+0301)
    //  - remove combining marks (U+0300..U+036F)
    //  - remove bidi/ZWSP/ZWJ/ZWNJ/BOM
    //  - normaliza todas as variações de espaço Unicode (NBSP, ideographic, etc)
    //  - colapsa múltiplos espaços
    //  - uppercase + trim
    // Resultado: "Avaliação Mensal do Médico" → "AVALIACAO MENSAL DO MEDICO"
    normalizar(texto) {
        if (!texto) return '';
        return String(texto)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
            .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
            .replace(/\s+/g, ' ')
            .toUpperCase()
            .trim();
    },

    validarAtendimento(atend) {
        if (!atend) return false;
        const num = String(atend).trim();
        if (!CONSTANTES.VALIDACAO.REGEX_ATENDIMENTO.test(num)) return false;
        const valor = parseInt(num);
        return (
            valor >= CONSTANTES.VALIDACAO.MIN_ATENDIMENTO &&
            valor <= CONSTANTES.VALIDACAO.MAX_ATENDIMENTO
        );
    },

    validarSessoes(sessoes) {
        const num = parseInt(sessoes);
        return !isNaN(num) && num >= 0 && num <= CONSTANTES.VALIDACAO.MAX_SESSOES;
    },

    rateLimiter: {
        requests: [],

        podeExecutar() {
            const agora = Date.now();
            this.requests = this.requests.filter(
                (t) => agora - t < CONSTANTES.RATE_LIMIT.JANELA_MS
            );

            if (this.requests.length >= CONSTANTES.RATE_LIMIT.MAX_ACOES_POR_MINUTO) {
                return false;
            }

            this.requests.push(agora);
            return true;
        },

        reset() {
            this.requests = [];
        }
    }
};
