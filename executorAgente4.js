// executorAgente4.js
'use strict';

import { getProcedimentos } from './procedures.js';
import { adicionarFluxoNormal } from './fluxoNormal.js';
import { adicionarFluxoPopup } from './fluxoPopup.js';

/**
 * Executa a rotina do "Agente 4": conta procedimentos na viewport e adiciona os que faltam.
 * @param {number} sessoesPlanilha - Número de sessões indicado na planilha (máximo 13)
 * @param {object} agente - Referência ao agente principal (deve conter métodos como log, esperar, contarTodosProcedimentos, etc.)
 * @returns {Promise<boolean>} true se tudo foi preenchido com sucesso
 */
export async function executarAgente4(sessoesPlanilha, agente) {
    // ⬇️ OBTÉM OS PROCEDIMENTOS ATUAIS DA CONFIGURAÇÃO (EDITOR DO PAINEL)
    const proc = getProcedimentos(agente.config);

    const alvo = Math.min(sessoesPlanilha, 13);
    agente.log(`🔍 Agente 4: alvo = ${alvo}`, 'info');

    const carregou = await agente.aguardarViewportCarregar();
    if (!carregou) return false;

    const c = await agente.contarTodosProcedimentos();
    if (!c) return false;

    agente.log(`🩺 Consultas: ${c.qtdConsulta}/${alvo}`, 'info');
    agente.log(`💊 Medicações: ${c.qtdMedicacao}/${alvo}`, 'info');
    agente.log(`🥗 ${c.temNutricao ? '✅' : '❌'} Nutrição`, 'info');
    agente.log(`🧠 ${c.temPsicologia ? '✅' : '❌'} Psicologia`, 'info');
    agente.log(`👥 ${c.temSocial ? '✅' : '❌'} Social`, 'info');
    agente.log(`🏥 ${c.temEnfermagem ? '✅' : '❌'} Enfermagem`, 'info');

    const procedimentosParaAdicionar = [];

    const faltamConsultas = alvo - c.qtdConsulta;
    if (faltamConsultas > 0)
        procedimentosParaAdicionar.push({
            tipo: proc.consulta.tipo || 'normal',
            codigo: proc.consulta.codigo,
            quantidade: faltamConsultas,
            nome: 'consulta'
        });

    const faltamMedicacoes = alvo - c.qtdMedicacao;
    if (faltamMedicacoes > 0)
        procedimentosParaAdicionar.push({
            tipo: proc.medicacao.tipo || 'popup',
            codigo: proc.medicacao.codigo,
            quantidade: faltamMedicacoes,
            nome: 'medicação'
        });

    if (!c.temNutricao)
        procedimentosParaAdicionar.push({
            tipo: 'normal',
            codigo: proc.nutricao.codigo,
            quantidade: 1,
            nome: 'nutrição'
        });
    if (!c.temPsicologia)
        procedimentosParaAdicionar.push({
            tipo: 'normal',
            codigo: proc.psicologia.codigo,
            quantidade: 1,
            nome: 'psicologia'
        });
    if (!c.temSocial)
        procedimentosParaAdicionar.push({
            tipo: 'normal',
            codigo: proc.social.codigo,
            quantidade: 1,
            nome: 'social'
        });
    if (!c.temEnfermagem)
        procedimentosParaAdicionar.push({
            tipo: 'normal',
            codigo: proc.enfermagem.codigo,
            quantidade: 1,
            nome: 'enfermagem'
        });

    for (const item of procedimentosParaAdicionar) {
        if (!agente.executando) return false;
        await agente.aguardarSePausado();

        let sucesso;
        if (item.tipo === 'normal') {
            sucesso = await adicionarFluxoNormal(item.codigo, item.quantidade, agente);
        } else {
            sucesso = await adicionarFluxoPopup(item.codigo, item.quantidade, agente);
        }
        agente.log(
            sucesso ? `✅ ${item.nome} confirmado` : `❌ Falha ao adicionar ${item.nome}`,
            sucesso ? 'sucesso' : 'erro'
        );
    }

    if (!agente.executando) return false;

    // Garante que a grade voltou a carregar de verdade antes de recontar
    agente.domCache.clear();
    await agente.aguardarViewportCarregar();
    const final = await agente.contarTodosProcedimentos();
    const ok =
        final &&
        final.qtdConsulta >= alvo &&
        final.qtdMedicacao >= alvo &&
        final.temNutricao &&
        final.temPsicologia &&
        final.temSocial &&
        final.temEnfermagem;
    agente.log(ok ? '✅ Tudo OK!' : '⚠️ Pendências restantes.', ok ? 'sucesso' : 'erro');
    return ok;
}
