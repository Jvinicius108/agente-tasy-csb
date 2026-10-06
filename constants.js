// constants.js
'use strict';

const CONSTANTES = Object.freeze({
    VERSAO: 'V40.3',
    ID_PAINEL: 'qg-v40',

    KEYS: {
        ESTADO: 'agente_tasy_estado_v40',
        STATS: 'agente_tasy_stats_v40',
        CONFIG: 'agente_tasy_config_v40',
        DIARIO: 'agente_tasy_diario_v40',
        VERSAO_DADOS: 'agente_tasy_versao_dados'
    },

    TEMPOS: {
        BASE: 1850,
        ESPERA_CURTA: 150,
        ESPERA_MEDIA: 400,
        ESPERA_LONGA: 800,
        SAFE_MODE_EXTRA: 400,
        RESET_INTERFACE: 1500,
        TIMEOUT_POPUP: 20000,
        TIMEOUT_VIEWPOR: 10000,
        CHECK_TASY: 3000,
        CHECK_PAUSA: 500,
        DEBOUNCE_CLICK: 300
    },

    LATENCIA: {
        HISTORICO_MAX: 10,
        NORMAL: 500,
        FATOR_MIN: 0.6,
        FATOR_MAX: 2.5,
        FATOR_SAFE_MIN: 1.0,
        FATOR_SAFE_MAX: 3.0
    },

    PACIENTES_POR_RESET: 8,

    RATE_LIMIT: {
        MAX_ACOES_POR_MINUTO: 30,
        JANELA_MS: 60000
    },

    VALIDACAO: {
        MIN_ATENDIMENTO: 1000,
        MAX_ATENDIMENTO: 999999,
        MAX_SESSOES: 999,
        REGEX_ATENDIMENTO: /^\d{4,6}$/
    },

    CIRCUIT_BREAKER: {
        MAX_ERROS_CONSECUTIVOS: 3,
        INTERVALO_PAUSA: 50,
        DURACAO_PAUSA: 120000
    },

    VERSAO_DADOS_ATUAL: 2
});
