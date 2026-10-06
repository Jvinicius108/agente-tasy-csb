// navegacao.js
'use strict';

import { CONSTANTES } from './constants.js';

/**
 * Troca o atendimento atual clicando no cabeçalho e editando inline.
 * @param {string} novoAtend - Número do atendimento a ser aberto
 * @param {object} agente - Referência ao agente principal
 * @returns {Promise<boolean>} true se conseguiu trocar
 */
export async function trocarAtendimentoPeloHeader(novoAtend, agente) {
    if (!agente.executando) return false;
    await agente.aguardarSePausado();
    await agente.fecharPopupsErro();

    const opcoes = { bubbles: true, cancelable: true, view: window };
    const camposHeader = Array.from(document.querySelectorAll('div.person-bar-field-info'));
    const campoAtend = camposHeader.find((el) => /^\d+$/.test(el.innerText.trim()));
    if (!campoAtend) {
        agente.log('❌ Cabeçalho não encontrado', 'erro');
        return false;
    }

    campoAtend.dispatchEvent(new MouseEvent('mouseover', opcoes));
    campoAtend.dispatchEvent(new MouseEvent('mouseenter', opcoes));
    campoAtend.dispatchEvent(new MouseEvent('mousemove', opcoes));
    await agente.esperar(400);

    const lapiz =
        campoAtend.querySelector('a.btn.inline-edit-link') ||
        campoAtend.parentElement?.querySelector('a.btn.inline-edit-link');
    if (!lapiz) {
        agente.log('❌ Lápis não apareceu', 'erro');
        return false;
    }

    try {
        const scope = angular.element(lapiz).scope();
        if (scope?.activateInlineEdit) scope.$apply(() => scope.activateInlineEdit());
        else lapiz.click();
    } catch (e) {
        lapiz.click();
    }

    await agente.esperar(600);

    let inputHeader = null;
    for (let i = 0; i < 10; i++) {
        inputHeader =
            campoAtend.querySelector('input') ||
            document.querySelector('.person-bar-field-info input');
        if (inputHeader?.getBoundingClientRect().width > 0) break;
        await agente.esperar(200);
    }
    if (!inputHeader) {
        agente.log('❌ Campo editável não apareceu', 'erro');
        return false;
    }

    inputHeader.focus();
    inputHeader.select();
    await agente.esperar(150);
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await agente.esperar(150);
    document.execCommand('insertText', false, novoAtend);
    inputHeader.dispatchEvent(new Event('input', { bubbles: true }));
    inputHeader.dispatchEvent(new Event('change', { bubbles: true }));
    await agente.esperar(400);
    inputHeader.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, keyCode: 13, key: 'Enter' })
    );
    agente.log(`✅ Trocado para atendimento ${novoAtend}`, 'sucesso');
    return true;
}

/**
 * Localiza e abre a conta BPA (mês anterior) na grid principal.
 * @param {object} agente - Referência ao agente principal
 * @returns {Promise<boolean>} true se a conta foi aberta
 */
export async function localizarEAbrirBPA(agente) {
    if (!agente.executando) return false;
    await agente.aguardarSePausado();

    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const ano = d.getFullYear();
    const ultimoDia = new Date(ano, d.getMonth() + 1, 0).getDate();
    const dataAlvo = `${ultimoDia}/${mes}/${ano}`;
    const refAlvo = `${mes}/${ano}`;

    agente.log(`🔍 Procurando BPA — ${dataAlvo}`, 'info');
    const linhas = Array.from(document.querySelectorAll('div.ui-widget-content.slick-row'));
    const linhaBPA =
        linhas.find((r) => r.innerText.includes('BPA') && r.innerText.includes(dataAlvo)) ||
        linhas.find((r) => r.innerText.includes('BPA') && r.innerText.includes(refAlvo));
    if (!linhaBPA) {
        agente.log('❌ BPA não encontrado', 'erro');
        return false;
    }

    linhaBPA.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
    );
    await agente.esperar(400);

    return new Promise((resolve) =>
        setTimeout(() => {
            try {
                const scope = angular.element(document.querySelector('w-datagrid')).scope();
                if (scope?.onDoubleClick) {
                    scope.$apply(() => scope.onDoubleClick(scope, { row: linhaBPA }));
                    agente.log('✅ Conta BPA aberta!', 'sucesso');
                    resolve(true);
                } else resolve(false);
            } catch (e) {
                resolve(false);
            }
        }, 400)
    );
}

/**
 * Realiza o primeiro fluxo: preenche atendimento no filtro, clica em Filtrar, Fechar e abre o BPA.
 * @param {string} atend - Número do atendimento
 * @param {object} agente - Referência ao agente principal
 * @returns {Promise<boolean>} true se conseguiu abrir a conta
 */
export async function primeiroFluxo(atend, agente) {
    if (!agente.executando) return false;
    await agente.aguardarSePausado();

    const campo = document.querySelector('input[name="NR_ATENDIMENTO"]');
    if (!campo) return false;

    campo.focus();
    campo.click();
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await agente.esperar(150);
    document.execCommand('insertText', false, atend);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    await agente.esperar(600);

    const btnF = agente.getBotao('FILTRAR');
    if (!btnF) return false;
    btnF.click();

    await agente.esperar();
    for (let i = 0; i < 10; i++) {
        if (!agente.executando) return false;
        await agente.aguardarSePausado();
        const btnC = agente.getBotao('FECHAR');
        if (btnC) {
            btnC.click();
            await agente.esperar();
            break;
        }
        await agente.esperar(300);
    }
    await agente.fecharPopupsErro();
    await agente.esperar(600);
    return await localizarEAbrirBPA(agente);
}
