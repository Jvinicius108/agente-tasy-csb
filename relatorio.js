// relatorio.js
'use strict';

import { SecurityUtils } from './securityUtils.js';
import { CONSTANTES } from './constants.js';

export function salvarEstatisticas(storage, relatorio, total, errorHandler) {
    try {
        const stats = storage.carregar(CONSTANTES.KEYS.STATS, {});
        const hoje = new Date().toISOString().split('T')[0];
        if (!stats[hoje]) stats[hoje] = { total: 0, sucesso: 0, pendencia: 0, pulado: 0 };
        stats[hoje].total += total;
        stats[hoje].sucesso += relatorio.sucesso.length;
        stats[hoje].pendencia += relatorio.pendencia.length;
        stats[hoje].pulado += relatorio.pulado.length;
        storage.salvar(CONSTANTES.KEYS.STATS, stats);
    } catch (e) {
        errorHandler.log(e, 'salvarEstatisticas');
    }
}

export function gerarDashboardHTML(storage) {
    try {
        const stats = storage.carregar(CONSTANTES.KEYS.STATS, {});
        const hoje = new Date().toISOString().split('T')[0];
        const dia = stats[hoje] || { total: 0, sucesso: 0, pendencia: 0, pulado: 0 };

        const ultimos7 = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const chave = d.toISOString().split('T')[0];
            const valor = stats[chave] || { total: 0, sucesso: 0 };
            ultimos7.push({ data: chave, total: valor.total, sucesso: valor.sucesso });
        }

        const semanal = ultimos7.reduce((acc, d) => acc + d.total, 0);
        const sucessoSemanal = ultimos7.reduce((acc, d) => acc + d.sucesso, 0);
        const taxaSucesso = semanal > 0 ? ((sucessoSemanal / semanal) * 100).toFixed(1) : 0;
        const dataFmt = hoje.split('-').reverse().join('/');

        return `
            <div style="margin-bottom:12px;">
                <div style="font-weight:600;color:#ecf0f1;margin-bottom:6px;">📊 Hoje (${dataFmt})</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
                    <div>✅ Processados: <b>${dia.total}</b></div>
                    <div>🎯 Sucesso: <b>${dia.sucesso}</b></div>
                    <div>⚠️ Pendências: <b>${dia.pendencia}</b></div>
                    <div>⏭️ Pulados: <b>${dia.pulado}</b></div>
                </div>
            </div>
            <div style="padding-top:12px;border-top:1px solid #34495e;">
                <div style="font-weight:600;color:#ecf0f1;margin-bottom:6px;">📈 Últimos 7 dias</div>
                <div style="font-size:11px;">
                    <div>Total: <b>${semanal}</b> atendimentos</div>
                    <div>Taxa de sucesso: <b>${taxaSucesso}%</b></div>
                </div>
            </div>
        `;
    } catch (e) {
        return 'Erro ao carregar estatísticas.';
    }
}

function extrairPacienteAtend(item) {
    if (item && typeof item.paciente === 'string' && typeof item.atend === 'string') {
        return { paciente: item.paciente, atend: item.atend };
    }
    const texto = (item && item.texto) || '';
    const idx = texto.indexOf(' | ');
    if (idx === -1) return { paciente: texto, atend: '' };
    return {
        paciente: texto.slice(0, idx),
        atend: texto.slice(idx + 3)
    };
}

export function exportarRelatorioCSV(relatorio, baixarArquivo, getTimestamp) {
    const linhas = [['Data', 'Hora', 'Atendimento', 'Paciente', 'Status', 'Detalhes']];

    relatorio.sucesso.forEach((r) => {
        const dt = r.timestamp || new Date();
        const { paciente, atend } = extrairPacienteAtend(r);
        linhas.push([
            dt.toLocaleDateString('pt-BR'),
            dt.toLocaleTimeString('pt-BR'),
            atend,
            paciente,
            'Sucesso',
            ''
        ]);
    });

    relatorio.pendencia.forEach((r) => {
        const dt = r.timestamp || new Date();
        const { paciente, atend } = extrairPacienteAtend(r);
        const detalhe = r.detalhe || r.motivo || '';
        linhas.push([
            dt.toLocaleDateString('pt-BR'),
            dt.toLocaleTimeString('pt-BR'),
            atend,
            paciente,
            'Pendência',
            detalhe
        ]);
    });

    relatorio.pulado.forEach((r) => {
        const dt = r.timestamp || new Date();
        const { paciente, atend } = extrairPacienteAtend(r);
        const detalhe = r.detalhe || r.motivo || 'BPA não encontrado';
        linhas.push([
            dt.toLocaleDateString('pt-BR'),
            dt.toLocaleTimeString('pt-BR'),
            atend,
            paciente,
            'Pulado',
            detalhe
        ]);
    });

    const csv = linhas.map((l) => l.join(';')).join('\n');
    baixarArquivo(csv, `relatorio_agente_${getTimestamp()}.csv`, 'text/csv');
}

export function exportarDiarioCSV(diario, baixarArquivo, getTimestamp) {
    if (!diario || diario.length === 0) return false;
    const linhas = [['Timestamp', 'Tipo', 'Mensagem']];
    diario.forEach((d) => linhas.push([d.timestamp, d.tipo, d.mensagem]));
    const csv = linhas.map((l) => l.join(';')).join('\n');
    baixarArquivo(csv, `diario_agente_${getTimestamp()}.csv`, 'text/csv');
    return true;
}

export function exportarLogTecnicoCSV(registrosTecnicos, baixarArquivo, getTimestamp) {
    if (!registrosTecnicos || registrosTecnicos.length === 0) return false;

    const linhas = [['Data', 'Hora', 'Paciente', 'Atendimento', 'Evento', 'Resultado', 'Detalhe']];

    registrosTecnicos.forEach((r) => {
        linhas.push([r.data, r.hora, r.paciente, r.atendimento, r.evento, r.resultado, r.detalhe]);
    });

    const csv = linhas.map((l) => l.join(';')).join('\n');
    baixarArquivo(csv, `log_tecnico_${getTimestamp()}.csv`, 'text/csv');
    return true;
}
