// relatorioPDF.js
'use strict';

export function exportarRelatorioPDF(relatorio) {
    // Verifica se o jsPDF está disponível (deve ser carregado globalmente)
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF não está carregado. Adicione a biblioteca ao projeto.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = new Date().toLocaleString('pt-BR');
    let y = 20;

    doc.setFontSize(16);
    doc.text('Relatório do Agente TASY CSB', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Gerado em: ${data}`, 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.text('Resumo:', 20, y);
    y += 7;
    doc.setFontSize(10);
    const total = relatorio.sucesso.length + relatorio.pendencia.length + relatorio.pulado.length;
    doc.text(`Total processados: ${total}`, 20, y);
    y += 5;
    doc.text(`Sucesso: ${relatorio.sucesso.length}`, 20, y);
    y += 5;
    doc.text(`Pendências: ${relatorio.pendencia.length}`, 20, y);
    y += 5;
    doc.text(`Pulados: ${relatorio.pulado.length}`, 20, y);
    y += 10;

    // Lista de sucessos
    if (relatorio.sucesso.length > 0) {
        doc.setFontSize(12);
        doc.text('Sucessos:', 20, y);
        y += 6;
        doc.setFontSize(9);
        relatorio.sucesso.forEach((item) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(item.texto, 25, y);
            y += 4;
        });
        y += 4;
    }

    // Pendências
    if (relatorio.pendencia.length > 0) {
        doc.setFontSize(12);
        doc.text('Pendências:', 20, y);
        y += 6;
        doc.setFontSize(9);
        relatorio.pendencia.forEach((item) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(item.texto, 25, y);
            y += 4;
        });
        y += 4;
    }

    // Pulados
    if (relatorio.pulado.length > 0) {
        doc.setFontSize(12);
        doc.text('Pulados:', 20, y);
        y += 6;
        doc.setFontSize(9);
        relatorio.pulado.forEach((item) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(item.texto, 25, y);
            y += 4;
        });
    }

    doc.save(`relatorio_agente_${new Date().toISOString().slice(0, 10)}.pdf`);
}
