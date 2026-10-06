// config.js
'use strict';

const CONFIG_PADRAO = Object.freeze({
    tempo: CONSTANTES.TEMPOS.BASE,
    retryAutomatico: true,
    notificacoes: true,
    som: true,
    debug: false,
    autoExport: false,
    safeMode: false,
    tempoDinamico: true,
    circuitBreakerAtivo: true,
    circuitBreakerMaxErros: 3,
    pausaProgramadaAtiva: true,
    pausaProgramadaIntervalo: 50,
    pausaProgramadaDuracao: 120000,
    procedimentos: [
        { nome: 'CONSULTA MEDICA EM ATEN', codigo: '13376', tipo: 'normal' },
        { nome: 'ADMINISTRACAO DE MEDICAMENTOS', codigo: '301100012', tipo: 'popup' },
        { nome: 'Avaliação Mensal de Nutrição', codigo: '13377', tipo: 'normal' },
        { nome: 'Avaliação Mensal de Psicologia', codigo: '13374', tipo: 'normal' },
        { nome: 'Avaliação Mensal do Serviço Social', codigo: '13375', tipo: 'normal' },
        { nome: 'Avaliação Mensal de Enfermagem', codigo: '13378', tipo: 'normal' }
    ]
});
