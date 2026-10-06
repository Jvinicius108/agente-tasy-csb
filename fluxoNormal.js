// fluxoNormal.js
'use strict';

import { SecurityUtils } from './securityUtils.js';
import { CONSTANTES } from './constants.js';

/**
 * Executa o fluxo de adição de procedimento via modo "normal" (sem popup complexo).
 * @param {string} codigo - Código do procedimento
 * @param {number} quantidade - Quantidade a adicionar (padrão 1)
 * @param {object} agente - Referência ao agente principal para acesso aos métodos auxiliares (esperar, fecharPopupsErro, etc.)
 * @returns {Promise<boolean>} true se adicionado com sucesso
 */
export async function adicionarFluxoNormal(codigo, quantidade = 1, agente) {
    const MAX_RETRIES = agente.config.retryAutomatico ? 2 : 0;

    for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
        if (!agente.executando) return false;
        await agente.aguardarSePausado();

        if (!SecurityUtils.rateLimiter.podeExecutar()) {
            await agente.esperar(2000);
        }

        agente.log(
            `➕ Normal: ${codigo}${quantidade > 1 ? ` (x${quantidade})` : ''} (tentativa ${tentativa + 1})`,
            'info'
        );
        await agente.fecharPopupsErro();

        const btnAdicionar = agente.getBotaoAdicionar();
        if (!btnAdicionar) {
            agente.log('❌ Adicionar não encontrado', 'erro');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }
        btnAdicionar.click();

        // Aguarda a janela de procedimento carregar completamente
        const janelaPronta = await agente.aguardarJanelaProcedimentoPronta();
        if (!janelaPronta) {
            agente.log('❌ Janela de procedimento não carregou', 'erro');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        // Agora busca o campo de código (já dentro da janela pronta)
        const campoCodigo = await agente.aguardarCampoCodigoDisponivel();
        await agente.fecharPopupsErro();

        if (!campoCodigo) {
            agente.log('❌ Campo não encontrado', 'erro');
            agente.logTecnico(
                `Adicionar código ${codigo}`,
                'erro',
                `Campo não encontrado (tentativa ${tentativa + 1})`
            );
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        campoCodigo.focus();
        campoCodigo.click();
        campoCodigo.value = '';
        campoCodigo.dispatchEvent(new Event('input', { bubbles: true }));
        await agente.esperar(150);
        document.execCommand('insertText', false, codigo);
        campoCodigo.dispatchEvent(new Event('input', { bubbles: true }));
        campoCodigo.dispatchEvent(new Event('change', { bubbles: true }));
        await agente.esperar(400);

        const areaSegura = Array.from(document.querySelectorAll('select')).find(
            (el) => el.getBoundingClientRect().width > 0
        );
        if (areaSegura) areaSegura.click();
        await agente.esperar();

        const temErro = await agente.fecharPopupsErro();
        if (temErro) {
            agente.log('❌ Erro ao confirmar código', 'erro');
            await agente.fecharPopupProcedimento();
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        if (quantidade > 1) await agente.alterarQuantidade(quantidade);
        await agente.alterarDataProcedimento();
        const salvou = await agente.salvarProcedimento();
        if (salvou) return true;
        if (tentativa < MAX_RETRIES) await agente.esperar(1000);
    }
    return false;
}
