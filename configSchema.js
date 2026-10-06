// configSchema.js
'use strict';

/**
 * Catálogo central de configurações do agente.
 * Para adicionar uma configuração nova no futuro, basta adicionar
 * um novo objeto neste array — o painel e o salvamento se ajustam sozinhos.
 *
 * Tipos disponíveis:
 * - 'numero': campo numérico simples
 * - 'checkbox': caixa de marcar simples
 * - 'checkbox-numero': checkbox + 1 campo numérico ao lado (ex: Circuit Breaker)
 * - 'checkbox-dois-numeros': checkbox + 2 campos numéricos (ex: Pausa programada)
 */
export const CONFIG_SCHEMA = [
    {
        id: 'cfg-tempo',
        key: 'tempo',
        label: 'Tempo base (ms):',
        type: 'numero',
        min: 500,
        max: 5000,
        step: 50
    },
    { id: 'cfg-retry', key: 'retryAutomatico', label: 'Retry automático', type: 'checkbox' },
    { id: 'cfg-notif', key: 'notificacoes', label: 'Notificações', type: 'checkbox' },
    { id: 'cfg-som', key: 'som', label: 'Som', type: 'checkbox' },
    { id: 'cfg-debug', key: 'debug', label: 'Modo debug', type: 'checkbox' },
    { id: 'cfg-autoexport', key: 'autoExport', label: 'Auto-exportar', type: 'checkbox' },
    { id: 'cfg-tempodinamico', key: 'tempoDinamico', label: 'Tempo dinâmico', type: 'checkbox' },
    { id: 'cfg-safe', key: 'safeMode', label: 'Safe Mode', type: 'checkbox' },
    {
        id: 'cfg-procedimentos',
        key: 'procedimentos',
        label: 'Procedimentos',
        type: 'procedimentos-editor'
    },
    {
        id: 'cfg-circuitbreaker',
        key: 'circuitBreakerAtivo',
        label: 'Circuit Breaker (máx. erros:',
        type: 'checkbox-numero',
        numeroId: 'cfg-circuitbreaker-max',
        numeroKey: 'circuitBreakerMaxErros',
        width: 40
    },
    {
        id: 'cfg-pausaprogramada',
        key: 'pausaProgramadaAtiva',
        label: 'Pausa a cada',
        type: 'checkbox-dois-numeros',
        num1Id: 'cfg-pausaprogramada-intervalo',
        num1Key: 'pausaProgramadaIntervalo',
        width1: 50,
        textoMeio: ' pcts, ',
        num2Id: 'cfg-pausaprogramada-duracao',
        num2Key: 'pausaProgramadaDuracao',
        width2: 50,
        textoDepois: 's',
        emSegundos: true
    }
];
