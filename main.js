// main.js
'use strict';

(function autoTesteBundle() {
    try {
        if (
            typeof SecurityUtils === 'undefined' ||
            typeof SecurityUtils.normalizar !== 'function'
        ) {
            console.error(
                '🚨 BUNDLE DESATUALIZADO: SecurityUtils.normalizar não existe. Rode "node build.js" e recarregue a extensão.'
            );
            return;
        }
        const teste = SecurityUtils.normalizar('Avaliação Mensal do Médico');
        if (teste === 'AVALIACAO MENSAL DO MEDICO') {
            console.log(
                `%c✅ Bundle ${CONSTANTES.VERSAO} - tudo OK (normalização validada)`,
                'color: #2ecc71; font-weight: bold;'
            );
        } else {
            console.error(
                `🚨 BUNDLE DESATUALIZADO ou normalização quebrada. Resultado: "${teste}" (esperado: "AVALIACAO MENSAL DO MEDICO"). Rode "node build.js" e recarregue a extensão.`
            );
        }
    } catch (e) {
        console.error('🚨 Erro no auto-teste do bundle:', e);
    }
})();

if (!window.__AGENTE_TASY_V40_LOADED__) {
    window.__AGENTE_TASY_V40_LOADED__ = true;

    function aguardarTasy(callback) {
        const check = setInterval(() => {
            const tasyCarregado = document.querySelector(
                '.corsisf1, [class*="tasy"], .w-feature-app__name'
            );
            if (tasyCarregado) {
                clearInterval(check);
                callback();
            }
        }, 1000);
        setTimeout(() => clearInterval(check), 30000);
    }

    function iniciar() {
        try {
            const agente = new AgenteTASY();
            agente.criarInterface();
            window.__AGENTE_TASY_INSTANCE__ = agente;
            console.log(
                `%c🤖 Agente TASY CSB ${CONSTANTES.VERSAO} carregado com sucesso!`,
                'color: #2ecc71; font-weight: bold; font-size: 14px;'
            );
        } catch (erro) {
            console.error('Erro ao inicializar agente:', erro);
        }
    }

    aguardarTasy(iniciar);
    window.addEventListener('abrirAgenteCSB', iniciar);
}
