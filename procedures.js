// procedures.js
'use strict';

import { SecurityUtils } from './securityUtils.js';

/**
 * Retorna os procedimentos ativos mesclando os valores da configuração
 * com os padrões.
 */

// Valores padrão (fallback)
const PADROES = Object.freeze({
    consulta: { codigo: '13376', nome: 'CONSULTA MEDICA EM ATEN' },
    medicacao: { codigo: '301100012', nome: 'ADMINISTRACAO DE MEDICAMENTOS' },
    nutricao: { codigo: '13377', nome: 'Avaliação Mensal de Nutrição' },
    psicologia: { codigo: '13374', nome: 'Avaliação Mensal de Psicologia' },
    social: { codigo: '13375', nome: 'Avaliação Mensal do Serviço Social' },
    enfermagem: { codigo: '13378', nome: 'Avaliação Mensal de Enfermagem' }
});

/**
 * Monta o objeto de procedimentos efetivos.
 *
 * REGRA "PRIMEIRO VENCE": se a config tiver mais de um procedimento que mapeia
 * para a mesma chave (ex: "CONSULTA MEDICA EM ATEN" e "Avaliação Mensal do Médico"
 * → ambos viram 'consulta'), o PRIMEIRO da lista define o código/tipo usado.
 * Isso evita que um sinônimo sobrescreva silenciosamente o código canônico.
 */
export function getProcedimentos(config) {
    const procedimentos = { ...PADROES };
    const chavesJaDefinidas = new Set();

    if (config && config.procedimentos && Array.isArray(config.procedimentos)) {
        config.procedimentos.forEach((proc) => {
            const chave = nomeParaChave(proc.nome);
            if (chavesJaDefinidas.has(chave)) return;
            chavesJaDefinidas.add(chave);

            procedimentos[chave] = {
                codigo: proc.codigo,
                nome: proc.nome,
                tipo: proc.tipo || 'normal'
            };
        });
    }

    return procedimentos;
}

/**
 * Converte um nome de procedimento em uma chave simplificada, ignorando
 * acentuação, espaços não-quebráveis e caracteres invisíveis.
 *
 *   "CONSULTA MEDICA EM ATEN"                → 'consulta'
 *   "Avaliação Mensal do Médico"             → 'consulta'
 *   "AVALIACAO MENSAL DO MEDICO"             → 'consulta'
 *   "Avaliacao Mensal do Medico"             → 'consulta'
 *   "ADMINISTRACAO DE MEDICAMENTOS"          → 'medicacao'
 *   "Avaliação Mensal de Nutrição"           → 'nutricao'
 *   "Avaliação Mensal de Psicologia"         → 'psicologia'
 *   "Avaliação Mensal do Serviço Social"     → 'social'
 *   "Avaliação Mensal de Enfermagem"         → 'enfermagem'
 */
function nomeParaChave(nome) {
    const n = SecurityUtils.normalizar(nome);

    if (n.includes('CONSULTA MEDICA')) return 'consulta';
    if (n.includes('AVALIACAO MENSAL DO MEDICO')) return 'consulta';
    // Rede de segurança final: se algo invisível sobrou entre as palavras,
    // ainda detecta pelos dois termos-chave.
    if (n.includes('AVALIACAO MENSAL') && n.includes('MEDICO')) return 'consulta';

    if (n.includes('ADMINISTRACAO DE MEDICAMENTOS') || n.includes('MEDICAMENTOS'))
        return 'medicacao';
    if (n.includes('NUTRICAO')) return 'nutricao';
    if (n.includes('PSICOLOGIA')) return 'psicologia';
    if (n.includes('SERVICO SOCIAL') || n.includes('SOCIAL')) return 'social';
    if (n.includes('ENFERMAGEM')) return 'enfermagem';
    return n.toLowerCase().replace(/\s+/g, '_');
}

// Compatibilidade com código legado.
export const PROCEDIMENTOS = PADROES;
