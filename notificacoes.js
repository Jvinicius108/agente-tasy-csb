// notificacoes.js
'use strict';

let _audioCtx = null;

function _getAudioContext() {
    if (!_audioCtx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        _audioCtx = new Ctor();
    }
    if (_audioCtx.state === 'suspended' && typeof _audioCtx.resume === 'function') {
        _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
}

export function tocarBeep(config, errorHandler) {
    if (!config.som) return;
    try {
        const ctx = _getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        errorHandler?.log(e, 'tocarBeep');
    }
}

export async function notificar(config, total, sucesso, errorHandler) {
    if (!config.notificacoes) return;
    try {
        if (Notification.permission === 'granted') {
            new Notification('Agente TASY CSB', {
                body: `✅ ${total} atendimentos processados (${sucesso} sucesso)!`,
                icon: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
            });
        } else if (Notification.permission !== 'denied') {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
                new Notification('Agente TASY CSB', {
                    body: `✅ ${total} atendimentos processados (${sucesso} sucesso)!`
                });
            }
        }
    } catch (e) {
        errorHandler?.log(e, 'notificar');
    }
}
