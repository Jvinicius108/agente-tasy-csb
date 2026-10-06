// fluxoPopup.js
'use strict';

import { SecurityUtils } from './securityUtils.js';
import { CONSTANTES } from './constants.js';

/**
 * Executa o fluxo de adição de procedimento via popup (ex: medicação).
 * @param {string} codigo - Código do procedimento
 * @param {number} quantidade - Quantidade a adicionar (padrão 1)
 * @param {object} agente - Referência ao agente principal
 * @returns {Promise<boolean>} true se adicionado com sucesso
 */
export async function adicionarFluxoPopup(codigo, quantidade = 1, agente) {
    const MAX_RETRIES = agente.config.retryAutomatico ? 2 : 0;

    for (let tentativa = 0; tentativa <= MAX_RETRIES; tentativa++) {
        if (!agente.executando) return false;
        await agente.aguardarSePausado();

        if (!SecurityUtils.rateLimiter.podeExecutar()) {
            await agente.esperar(2000);
        }

        agente.log(
            `➕ Popup: ${codigo}${quantidade > 1 ? ` (x${quantidade})` : ''} (tentativa ${tentativa + 1})`,
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
        await agente.esperar();
        await agente.fecharPopupsErro();

        // ⬇️ NOVO: aguardar a janela de procedimento ficar pronta (foco + DT preenchida)
        const janelaPronta = await agente.aguardarJanelaProcedimentoPronta();
        if (!janelaPronta) {
            agente.log('❌ Janela de procedimento não ficou pronta (popup)', 'erro');
            agente.logTecnico(`Adicionar popup código ${codigo}`, 'erro', 'Janela não pronta');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        const inputs = Array.from(document.querySelectorAll('input[type="text"]')).filter(
            (el) => el.getBoundingClientRect().width > 0
        );
        const campoCodigo = inputs[1] || inputs[0];
        if (!campoCodigo) {
            agente.log('❌ Campo não encontrado', 'erro');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        campoCodigo.focus();
        campoCodigo.click();
        await agente.esperar(200);
        campoCodigo.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, keyCode: 13, key: 'Enter' })
        );
        campoCodigo.dispatchEvent(
            new KeyboardEvent('keyup', { bubbles: true, keyCode: 13, key: 'Enter' })
        );

        agente.log('⏳ Aguardando popup...', 'info');
        let popupAbriu = false;
        const inicioPopup = performance.now();
        for (let t = 0; t < 20; t++) {
            if (!agente.executando) return false;
            await agente.aguardarSePausado();
            const abaCorreta = Array.from(document.querySelectorAll('div.wtab')).find(
                (el) =>
                    el.querySelector('.wtab-label, .ng-binding')?.innerText.trim() ===
                        'Procedimento' && el.getBoundingClientRect().width > 0
            );
            if (abaCorreta) {
                popupAbriu = true;
                agente.registrarLatencia(performance.now() - inicioPopup);
                agente.log('✅ Popup aberto', 'sucesso');
                abaCorreta.click();
                await agente.esperar();
                break;
            }
            await new Promise((r) => setTimeout(r, 400));
        }
        if (!popupAbriu) {
            agente.log('❌ Popup não abriu', 'erro');
            await agente.fecharPopupsErro();
            await agente.fecharPopupProcedimento();
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        const campoListbox = Array.from(
            document.querySelectorAll('.w-listbox, [class*="listbox"]')
        ).find((el) => el.innerText.includes('Descrição') && el.getBoundingClientRect().width > 0);
        if (campoListbox) {
            campoListbox.click();
            await agente.esperar(600);
            const opcaoCodigo = Array.from(document.querySelectorAll('span, div')).find(
                (el) =>
                    el.innerText.trim() === 'Código' &&
                    el.getBoundingClientRect().width > 0 &&
                    !el.className.includes('slick')
            );
            if (opcaoCodigo) {
                opcaoCodigo.click();
                await agente.esperar(400);
            }
        }

        const inputCodigo = document.querySelector('input[name="DS_DESCRICAO"]');
        if (!inputCodigo) {
            agente.log('❌ DS_DESCRICAO não encontrado', 'erro');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        inputCodigo.focus();
        inputCodigo.click();
        inputCodigo.value = '';
        inputCodigo.dispatchEvent(new Event('input', { bubbles: true }));
        await agente.esperar(150);
        for (let char of codigo) {
            inputCodigo.value += char;
            inputCodigo.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 50));
        }
        inputCodigo.dispatchEvent(new Event('change', { bubbles: true }));
        await agente.esperar(400);

        const btnFiltrar = Array.from(document.querySelectorAll('button')).find(
            (b) =>
                b.innerText.trim().toUpperCase() === 'FILTRAR' &&
                b.getBoundingClientRect().width > 0
        );
        if (!btnFiltrar) {
            agente.log('❌ Filtrar não encontrado', 'erro');
            await agente.fecharPopupProcedimento();
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        agente.log('🔍 Filtrando...', 'info');
        btnFiltrar.click();
        await agente.esperar(agente.config.tempo + 500);

        agente.log('🔍 Procurando botão OK...', 'info');
        let btnOk = null;
        const inicioOk = performance.now();
        for (let tOk = 0; tOk < 8; tOk++) {
            const btnsOkVisiveis = Array.from(
                document.querySelectorAll('button, div[role="button"], span')
            ).filter((b) => {
                const texto = b.innerText.trim().toUpperCase();
                return (
                    texto === 'OK' &&
                    b.getBoundingClientRect().width > 0 &&
                    !b.closest(`#${CONSTANTES.ID_PAINEL}`) &&
                    (b.tagName === 'BUTTON' || getComputedStyle(b).cursor === 'pointer')
                );
            });
            if (btnsOkVisiveis.length > 0) {
                btnOk = btnsOkVisiveis[btnsOkVisiveis.length - 1];
                agente.registrarLatencia(performance.now() - inicioOk);
                agente.log(`✅ OK encontrado (tentativa ${tOk + 1})`, 'sucesso');
                break;
            }
            if (tOk < 7) {
                await new Promise((r) => setTimeout(r, 800));
                const abaAindaExiste = Array.from(document.querySelectorAll('div.wtab')).find(
                    (el) =>
                        el.querySelector('.wtab-label, .ng-binding')?.innerText.trim() ===
                            'Procedimento' && el.getBoundingClientRect().width > 0
                );
                if (!abaAindaExiste) {
                    agente.log('❌ Popup fechou enquanto procurava OK', 'erro');
                    if (tentativa < MAX_RETRIES) break;
                    return false;
                }
            }
        }

        if (!btnOk) {
            agente.log('❌ OK não encontrado após 8 tentativas', 'erro');
            await agente.fecharPopupProcedimento();
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }

        agente.log('✅ Clicando OK...', 'info');
        btnOk.click();

        agente.log('⏳ Aguardando fechamento do popup...', 'info');
        const popupFechou = await agente.aguardarFechamentoPopupProcedimento(20000);
        if (!popupFechou) {
            agente.log('❌ Timeout: Popup não fechou após OK', 'erro');
            if (tentativa < MAX_RETRIES) continue;
            return false;
        }
        agente.log('✅ Popup fechado', 'sucesso');

        await agente.esperar(800);

        const popupAvisoFechado = await agente.fecharPopupsErro();
        if (popupAvisoFechado) {
            agente.log('⚠️ Pop-up de aviso fechado', 'info');
            await agente.esperar(500);
        }

        if (quantidade > 1) {
            const qtdOk = await agente.alterarQuantidade(quantidade);
            if (!qtdOk) return false;
        }

        const dataOk = await agente.alterarDataProcedimento();
        if (!dataOk) return false;

        const salvou = await agente.salvarProcedimento();
        if (salvou) return true;
        if (tentativa < MAX_RETRIES) await agente.esperar(1000);
    }
    return false;
}
