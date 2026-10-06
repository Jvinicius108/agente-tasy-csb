// uiPainel.js
'use strict';

import { CONSTANTES } from './constants.js';
import { SecurityUtils } from './securityUtils.js';
import { CONFIG_SCHEMA } from './configSchema.js';

/**
 * Classe responsável pela interface do usuário do Agente TASY.
 * Constrói o painel via DOM, gerencia eventos, atualiza estados visuais.
 */
export class UIPainel {
    constructor(callbacks = {}) {
        // Referências para elementos importantes
        this.painel = null;
        this.statusBox = null;
        this.progressoContainer = null;
        this.progressoBarra = null;
        this.progressoTexto = null;
        this.progressoTempo = null;
        this.inputExcel = null;
        this.avisoRecuperacao = null;
        this.avisoDetalhe = null;
        this.miniBtn = null;
        this.painelPerformance = null;

        // Callbacks para ações
        this.callbacks = {
            onStart: callbacks.onStart || (() => {}),
            onPause: callbacks.onPause || (() => {}),
            onStop: callbacks.onStop || (() => {}),
            onConfigSave: callbacks.onConfigSave || (() => {}),
            onRetomar: callbacks.onRetomar || (() => {}),
            onDescartar: callbacks.onDescartar || (() => {}),
            onExportErrors: callbacks.onExportErrors || (() => {}),
            onClearErrors: callbacks.onClearErrors || (() => {}),
            onExportRelatorio: callbacks.onExportRelatorio || (() => {}),
            onExportLog: callbacks.onExportLog || (() => {}),
            onExportLogTecnico: callbacks.onExportLogTecnico || (() => {}),
            onFiscal: callbacks.onFiscal || (() => {}),
            onStats: callbacks.onStats || (() => {}),
            onErrors: callbacks.onErrors || (() => {})
        };

        this.listeners = [];
    }

    /**
     * Cria e exibe o painel completo.
     * @param {object} config - Configurações atuais do agente
     * @param {string} mesRef - Mês de referência (ex: "04/2026")
     */
    criarInterface(config, mesRef) {
        // Se já existe, remove
        if (document.getElementById(CONSTANTES.ID_PAINEL)) return;
        this.currentConfig = config;

        // Container principal
        this.painel = document.createElement('div');
        this.painel.id = CONSTANTES.ID_PAINEL;
        Object.assign(this.painel.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '100000',
            background: '#1e272e',
            color: 'white',
            borderRadius: '10px',
            width: '420px',
            height: '650px',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
            border: '2px solid #2ecc71',
            transition: 'opacity 0.3s'
        });

        // Cabeçalho
        const header = this._criarHeader();
        this.painel.appendChild(header);

        // Corpo
        this.corpo = document.createElement('div');
        this.corpo.id = 'painel-corpo';
        Object.assign(this.corpo.style, {
            display: 'flex',
            flexDirection: 'column',
            flex: '1',
            overflow: 'hidden',
            padding: '15px'
        });

        // Painel de Configurações (inicia oculto)
        this.painelConfig = this._criarPainelConfig(config);

        // Painel de Estatísticas (inicia oculto)
        this.painelStats = this._criarPainelStats();
        this.corpo.appendChild(this.painelStats);

        // Painel de Erros (inicia oculto)
        this.painelErrors = this._criarPainelErrors();
        this.corpo.appendChild(this.painelErrors);

        // Painel de Performance (inicia oculto)
        this.painelPerformance = this._criarPainelPerformance();
        this.corpo.appendChild(this.painelPerformance);

        // Barra de Progresso
        this.progressoContainer = this._criarBarraProgresso();
        this.corpo.appendChild(this.progressoContainer);

        // Textarea de entrada
        this.inputExcel = this._criarTextarea();
        this.corpo.appendChild(this.inputExcel);

        // Status Box
        this.statusBox = this._criarStatusBox();
        this.corpo.appendChild(this.statusBox);

        // Aviso de Recuperação
        this.avisoRecuperacao = this._criarAvisoRecuperacao();
        this.corpo.appendChild(this.avisoRecuperacao);

        // Indicadores de Status
        this.corpo.appendChild(this._criarIndicadores(mesRef));

        // Botões de Controle
        this.botoesControle = this._criarBotoesControle();
        this.corpo.appendChild(this.botoesControle);

        this.painel.appendChild(this.corpo);
        document.body.appendChild(this.painel);

        // Vincular eventos e tornar arrastável
        this._vincularEventos();
        this._tornarArrastavel(header);

        // Container do modal de configurações (inicia oculto)
        this.modalConfig = document.createElement('div');
        this.modalConfig.id = 'modal-config';
        Object.assign(this.modalConfig.style, {
            display: 'none',
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '100001',
            background: '#1e272e',
            color: 'white',
            borderRadius: '10px',
            width: '450px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
            border: '2px solid #3498db',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        });

        // Título do modal
        const tituloModal = document.createElement('h3');
        tituloModal.textContent = '⚙️ Configurações Avançadas';
        Object.assign(tituloModal.style, {
            margin: '0 0 15px 0',
            color: '#3498db',
            fontSize: '16px',
            fontWeight: '600'
        });
        this.modalConfig.appendChild(tituloModal);

        // Área onde o formulário será inserido
        this.configFormContainer = document.createElement('div');
        this.modalConfig.appendChild(this.configFormContainer);

        // Botão Fechar no rodapé do modal
        const btnFecharModal = document.createElement('button');
        btnFecharModal.textContent = 'Fechar';
        Object.assign(btnFecharModal.style, {
            marginTop: '15px',
            padding: '8px 20px',
            background: '#7f8c8d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500'
        });

        btnFecharModal.addEventListener('click', () => {
            this.modalConfig.style.display = 'none';
            // Restaura os estilos originais de ocultação
            if (this.painelConfig) {
                this.painelConfig.style.display = 'none';
                this.painelConfig.style.opacity = '0';
                this.painelConfig.style.maxHeight = '0';
                this.painelConfig.style.overflow = 'hidden';
                // Devolve o formulário ao corpo principal
                if (!this.corpo.contains(this.painelConfig)) {
                    this.corpo.appendChild(this.painelConfig);
                }
            }
        });

        this.modalConfig.appendChild(btnFecharModal);
        document.body.appendChild(this.modalConfig);
    }

    _criarEditorProcedimentos(procedimentos) {
        // ← MUDOU: garante array. Config corrompida (null/undefined/objeto) não
        // derruba mais a UI inteira ao abrir o modal de configurações.
        const lista = Array.isArray(procedimentos) ? procedimentos : [];

        const container = document.createElement('div');
        container.style.marginTop = '15px';
        container.style.borderTop = '1px solid #34495e';
        container.style.paddingTop = '15px';

        // Título da seção
        const titulo = document.createElement('div');
        titulo.textContent = '🧩 Procedimentos';
        Object.assign(titulo.style, {
            fontWeight: '600',
            color: '#ecf0f1',
            marginBottom: '10px',
            fontSize: '14px'
        });
        container.appendChild(titulo);

        // Container da tabela
        const tabela = document.createElement('div');
        tabela.style.display = 'grid';
        tabela.style.gridTemplateColumns = '1fr 100px 80px 50px';
        tabela.style.gap = '6px';
        tabela.style.fontSize = '11px';
        tabela.style.maxHeight = '200px';
        tabela.style.overflowY = 'auto';

        // Cabeçalho
        const cabecalhos = ['Nome', 'Código', 'Tipo', ''];

        const renderizarCabecalhos = () => {
            cabecalhos.forEach((texto) => {
                const th = document.createElement('div');
                th.textContent = texto;
                th.style.fontWeight = '600';
                th.style.color = '#95a5a6';
                th.style.padding = '4px';
                tabela.appendChild(th);
            });
        };

        // Função para renderizar uma linha
        const renderizarLinha = (proc, index, array) => {
            const nomeInput = document.createElement('input');
            nomeInput.type = 'text';
            nomeInput.value = proc.nome || '';
            nomeInput.style.cssText =
                'width:100%;background:#34495e;color:white;border:1px solid #7f8c8d;padding:2px 4px;border-radius:3px;';
            nomeInput.addEventListener('input', () => {
                array[index].nome = nomeInput.value;
            });
            tabela.appendChild(nomeInput);

            const codigoInput = document.createElement('input');
            codigoInput.type = 'text';
            codigoInput.value = proc.codigo || '';
            codigoInput.style.cssText =
                'width:100%;background:#34495e;color:white;border:1px solid #7f8c8d;padding:2px 4px;border-radius:3px;';
            codigoInput.addEventListener('input', () => {
                array[index].codigo = codigoInput.value;
            });
            tabela.appendChild(codigoInput);

            const tipoSelect = document.createElement('select');
            tipoSelect.style.cssText =
                'width:100%;background:#34495e;color:white;border:1px solid #7f8c8d;padding:2px 4px;border-radius:3px;';
            ['normal', 'popup'].forEach((tipo) => {
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                if (proc.tipo === tipo) opt.selected = true;
                tipoSelect.appendChild(opt);
            });
            tipoSelect.addEventListener('change', () => {
                array[index].tipo = tipoSelect.value;
            });
            tabela.appendChild(tipoSelect);

            const btnRemover = document.createElement('button');
            btnRemover.textContent = '✕';
            btnRemover.style.cssText =
                'background:#e74c3c;color:white;border:none;border-radius:3px;cursor:pointer;font-weight:bold;';
            btnRemover.addEventListener('click', () => {
                array.splice(index, 1);
                // Re-renderiza a tabela
                tabela.innerHTML = '';
                renderizarCabecalhos();
                array.forEach((p, i, arr) => renderizarLinha(p, i, arr));
            });
            tabela.appendChild(btnRemover);
        };

        // Renderiza cabeçalhos + todas as linhas
        renderizarCabecalhos();
        lista.forEach((proc, index, array) => renderizarLinha(proc, index, array));

        container.appendChild(tabela);

        // Botão "Adicionar"
        const btnAdicionar = document.createElement('button');
        btnAdicionar.textContent = '+ Adicionar Procedimento';
        Object.assign(btnAdicionar.style, {
            marginTop: '10px',
            padding: '6px 12px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '11px'
        });
        btnAdicionar.addEventListener('click', () => {
            // ← MUDOU: sempre adiciona no array real da config atual.
            // Isso evita o caso em que `lista` é um array vazio local (cópia)
            // e o usuário adiciona itens que não persistem.
            if (!Array.isArray(this.currentConfig.procedimentos)) {
                this.currentConfig.procedimentos = [];
            }
            const alvo = this.currentConfig.procedimentos;
            alvo.push({ nome: 'Novo Procedimento', codigo: '', tipo: 'normal' });

            // Re-renderiza tudo
            tabela.innerHTML = '';
            renderizarCabecalhos();
            alvo.forEach((p, i, arr) => renderizarLinha(p, i, arr));
            tabela.scrollTop = tabela.scrollHeight;
        });
        container.appendChild(btnAdicionar);

        return container;
    }

    // ==================== MÉTODOS DE CRIAÇÃO DE ELEMENTOS ====================

    _criarHeader() {
        const header = document.createElement('div');
        header.id = 'painel-header';
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px',
            flexShrink: '0',
            background: '#2d3436',
            borderRadius: '8px 8px 0 0',
            cursor: 'move'
        });

        const titulo = document.createElement('h2');
        titulo.textContent = `🤖 AGENTE TASY CSB — ${CONSTANTES.VERSAO}`;
        Object.assign(titulo.style, {
            fontSize: '14px',
            margin: '0',
            color: '#2ecc71',
            fontWeight: '600'
        });
        header.appendChild(titulo);

        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'flex';
        botoesDiv.style.gap = '8px';

        const btnStats = this._criarBotaoIcone(
            '📊',
            '#f1c40f',
            'btn-stats',
            'Dashboard de Estatísticas'
        );
        const btnConfig = this._criarBotaoIcone('⚙️', '#3498db', 'btn-config', 'Configurações');
        const btnErrors = this._criarBotaoIcone('🐛', '#e74c3c', 'btn-errors', 'Log de Erros');
        const btnMinimizar = this._criarBotaoIcone(
            '—',
            '#95a5a6',
            'btn-minimizar',
            'Minimizar painel'
        );
        const btnPerf = this._criarBotaoIcone('📈', '#e67e22', 'btn-perf', 'Performance');

        botoesDiv.appendChild(btnStats);
        botoesDiv.appendChild(btnConfig);
        botoesDiv.appendChild(btnErrors);
        botoesDiv.appendChild(btnPerf);
        botoesDiv.appendChild(btnMinimizar);
        header.appendChild(botoesDiv);

        return header;
    }

    _criarBotaoIcone(texto, cor, id, title) {
        const btn = document.createElement('button');
        btn.textContent = texto;
        btn.id = id;
        btn.title = title;
        Object.assign(btn.style, {
            background: 'none',
            border: 'none',
            color: cor,
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background 0.2s'
        });
        btn.addEventListener('mouseenter', () => (btn.style.background = 'rgba(255,255,255,0.1)'));
        btn.addEventListener('mouseleave', () => (btn.style.background = 'none'));
        return btn;
    }

    _criarPainelConfig(config) {
        const painel = document.createElement('div');
        painel.id = 'painel-config';
        Object.assign(painel.style, {
            display: 'none',
            opacity: '0',
            maxHeight: '0',
            overflow: 'hidden',
            transition: 'opacity 0.2s, max-height 0.2s',
            marginBottom: '10px',
            padding: '12px',
            background: '#2c3e50',
            borderRadius: '6px',
            fontSize: '12px',
            flexShrink: '0'
        });

        const titulo = document.createElement('div');
        titulo.textContent = 'Configurações';
        Object.assign(titulo.style, {
            marginBottom: '10px',
            fontWeight: '600',
            color: '#ecf0f1'
        });
        painel.appendChild(titulo);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = '8px';

        CONFIG_SCHEMA.forEach((campo) => {
            grid.appendChild(this._criarCampoPorSchema(campo, config));
        });

        painel.appendChild(grid);

        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'flex';
        botoesDiv.style.gap = '8px';
        botoesDiv.style.marginTop = '12px';

        const btnSalvar = document.createElement('button');
        btnSalvar.id = 'btn-salvar-config';
        btnSalvar.textContent = 'Salvar';
        Object.assign(btnSalvar.style, {
            flex: '1',
            padding: '8px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500'
        });
        botoesDiv.appendChild(btnSalvar);

        const btnFechar = document.createElement('button');
        btnFechar.id = 'btn-fechar-config';
        btnFechar.textContent = 'Fechar';
        Object.assign(btnFechar.style, {
            flex: '1',
            padding: '8px',
            background: '#7f8c8d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500'
        });
        botoesDiv.appendChild(btnFechar);
        painel.appendChild(botoesDiv);

        return painel;
    }

    _criarPainelPerformance() {
        const painel = document.createElement('div');
        painel.id = 'painel-performance';
        Object.assign(painel.style, {
            display: 'none',
            opacity: '0',
            maxHeight: '0',
            overflow: 'hidden',
            transition: 'opacity 0.2s, max-height 0.2s',
            marginBottom: '10px',
            padding: '12px',
            background: '#2c3e50',
            borderRadius: '6px',
            fontSize: '12px',
            flexShrink: '0'
        });

        // Título
        const titulo = document.createElement('div');
        titulo.textContent = '📈 Performance';
        Object.assign(titulo.style, {
            fontWeight: '600',
            color: '#ecf0f1',
            marginBottom: '10px'
        });
        painel.appendChild(titulo);

        // Container das métricas (atualizado em tempo real)
        const metricasDiv = document.createElement('div');
        metricasDiv.id = 'perf-metricas';
        Object.assign(metricasDiv.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginBottom: '12px',
            fontSize: '11px'
        });

        // Métricas iniciais (placeholder)
        const metricas = [
            { label: '⏱️ Tempo decorrido:', id: 'perf-tempo-decorrido', valor: '--' },
            { label: '👥 Processados:', id: 'perf-processados', valor: '0' },
            { label: '✅ Sucessos:', id: 'perf-sucessos', valor: '0' },
            { label: '⚠️ Pendências:', id: 'perf-pendencias', valor: '0' },
            { label: '⚡ Média/paciente:', id: 'perf-media', valor: '--' },
            { label: '🐌 Gargalo:', id: 'perf-gargalo', valor: '--' }
        ];

        metricas.forEach((m) => {
            const div = document.createElement('div');
            div.innerHTML = `${m.label} <b id="${m.id}">${m.valor}</b>`;
            metricasDiv.appendChild(div);
        });
        painel.appendChild(metricasDiv);

        // Container do gráfico de barras
        const graficoDiv = document.createElement('div');
        graficoDiv.id = 'perf-grafico';
        Object.assign(graficoDiv.style, {
            maxHeight: '200px',
            overflowY: 'auto',
            background: '#1e272e',
            borderRadius: '4px',
            padding: '8px',
            fontFamily: 'monospace',
            fontSize: '10px'
        });
        // Placeholder
        graficoDiv.textContent = 'Nenhum paciente processado ainda.';
        painel.appendChild(graficoDiv);

        return painel;
    }

    _criarCampoNumero(label, id, valor, min, max, step) {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.flex = '1';
        div.appendChild(lbl);

        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.value = valor;
        input.min = min;
        input.max = max;
        input.step = step;
        Object.assign(input.style, {
            width: '90px',
            background: '#34495e',
            color: 'white',
            border: '1px solid #7f8c8d',
            padding: '4px 6px',
            borderRadius: '4px'
        });
        div.appendChild(input);
        return div;
    }

    _criarCheckbox(label, id, checked) {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '8px';
        lbl.style.cursor = 'pointer';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = checked;
        lbl.appendChild(input);

        const span = document.createElement('span');
        span.textContent = label;
        lbl.appendChild(span);

        return lbl;
    }

    _criarCheckboxComNumeros(
        textoAntes,
        idCheck,
        checked,
        idNum1,
        valNum1,
        width1,
        textoMeio,
        idNum2,
        valNum2,
        width2,
        textoDepois
    ) {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '4px';
        lbl.style.cursor = 'pointer';

        const inputCheck = document.createElement('input');
        inputCheck.type = 'checkbox';
        inputCheck.id = idCheck;
        inputCheck.checked = checked;
        lbl.appendChild(inputCheck);

        lbl.appendChild(document.createTextNode(textoAntes));

        const inputNum1 = document.createElement('input');
        inputNum1.type = 'number';
        inputNum1.id = idNum1;
        inputNum1.value = valNum1;
        Object.assign(inputNum1.style, {
            width: width1 + 'px',
            background: '#34495e',
            color: 'white',
            border: '1px solid #7f8c8d',
            padding: '2px'
        });
        lbl.appendChild(inputNum1);

        if (textoMeio) lbl.appendChild(document.createTextNode(textoMeio));

        if (idNum2) {
            const inputNum2 = document.createElement('input');
            inputNum2.type = 'number';
            inputNum2.id = idNum2;
            inputNum2.value = valNum2;
            Object.assign(inputNum2.style, {
                width: width2 + 'px',
                background: '#34495e',
                color: 'white',
                border: '1px solid #7f8c8d',
                padding: '2px'
            });
            lbl.appendChild(inputNum2);
        }

        if (textoDepois) lbl.appendChild(document.createTextNode(textoDepois));

        return lbl;
    }

    _criarCampoPorSchema(campo, config) {
        switch (campo.type) {
            case 'numero':
                return this._criarCampoNumero(
                    campo.label,
                    campo.id,
                    config[campo.key],
                    campo.min,
                    campo.max,
                    campo.step
                );

            case 'procedimentos-editor':
                return this._criarEditorProcedimentos(config[campo.key]);

            case 'checkbox':
                return this._criarCheckbox(campo.label, campo.id, config[campo.key]);

            case 'checkbox-numero':
                return this._criarCheckboxComNumeros(
                    campo.label,
                    campo.id,
                    config[campo.key],
                    campo.numeroId,
                    config[campo.numeroKey],
                    campo.width
                );

            case 'checkbox-dois-numeros': {
                const valorNum2 = campo.emSegundos
                    ? config[campo.num2Key] / 1000
                    : config[campo.num2Key];
                return this._criarCheckboxComNumeros(
                    campo.label,
                    campo.id,
                    config[campo.key],
                    campo.num1Id,
                    config[campo.num1Key],
                    campo.width1,
                    campo.textoMeio,
                    campo.num2Id,
                    valorNum2,
                    campo.width2,
                    campo.textoDepois
                );
            }

            default:
                return document.createElement('div'); // tipo desconhecido, ignora
        }
    }

    _criarPainelStats() {
        const painel = document.createElement('div');
        painel.id = 'painel-stats';
        Object.assign(painel.style, {
            display: 'none',
            opacity: '0',
            maxHeight: '0',
            overflow: 'hidden',
            transition: 'opacity 0.2s, max-height 0.2s',
            marginBottom: '10px',
            padding: '12px',
            background: '#2c3e50',
            borderRadius: '6px',
            fontSize: '12px',
            flexShrink: '0'
        });

        const conteudo = document.createElement('div');
        conteudo.id = 'stats-conteudo';
        conteudo.textContent = 'Abra para carregar...';
        painel.appendChild(conteudo);

        return painel;
    }

    _criarPainelErrors() {
        const painel = document.createElement('div');
        painel.id = 'painel-errors';
        Object.assign(painel.style, {
            display: 'none',
            opacity: '0',
            maxHeight: '0',
            overflow: 'hidden',
            transition: 'opacity 0.2s, max-height 0.2s',
            marginBottom: '10px',
            padding: '12px',
            background: '#2c3e50',
            borderRadius: '6px',
            fontSize: '11px',
            flexShrink: '0'
        });

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '8px';

        const titulo = document.createElement('div');
        titulo.textContent = 'Log de Erros';
        Object.assign(titulo.style, {
            fontWeight: '600',
            color: '#ecf0f1'
        });
        header.appendChild(titulo);

        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'flex';
        botoesDiv.style.gap = '4px';

        const btnExport = document.createElement('button');
        btnExport.id = 'btn-export-errors';
        btnExport.textContent = 'Exportar';
        Object.assign(btnExport.style, {
            padding: '4px 8px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px'
        });
        botoesDiv.appendChild(btnExport);

        const btnClear = document.createElement('button');
        btnClear.id = 'btn-clear-errors';
        btnClear.textContent = 'Limpar';
        Object.assign(btnClear.style, {
            padding: '4px 8px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px'
        });
        botoesDiv.appendChild(btnClear);
        header.appendChild(botoesDiv);
        painel.appendChild(header);

        const conteudo = document.createElement('div');
        conteudo.id = 'errors-conteudo';
        conteudo.textContent = 'Nenhum erro registrado';
        Object.assign(conteudo.style, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ecf0f1'
        });
        painel.appendChild(conteudo);

        return painel;
    }

    _criarBarraProgresso() {
        const container = document.createElement('div');
        container.id = 'progresso-container';
        Object.assign(container.style, {
            display: 'none',
            marginBottom: '10px',
            flexShrink: '0'
        });

        const infoDiv = document.createElement('div');
        Object.assign(infoDiv.style, {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            marginBottom: '4px'
        });

        this.progressoTexto = document.createElement('span');
        this.progressoTexto.id = 'progresso-texto';
        this.progressoTexto.textContent = '0%';
        infoDiv.appendChild(this.progressoTexto);

        this.progressoTempo = document.createElement('span');
        this.progressoTempo.id = 'progresso-tempo';
        this.progressoTempo.textContent = '--';
        infoDiv.appendChild(this.progressoTempo);
        container.appendChild(infoDiv);

        const barraFundo = document.createElement('div');
        Object.assign(barraFundo.style, {
            width: '100%',
            height: '8px',
            background: '#2c3e50',
            borderRadius: '4px',
            overflow: 'hidden'
        });

        this.progressoBarra = document.createElement('div');
        this.progressoBarra.id = 'progresso-barra';
        Object.assign(this.progressoBarra.style, {
            width: '0%',
            height: '100%',
            background: '#2ecc71',
            transition: 'width 0.3s'
        });
        barraFundo.appendChild(this.progressoBarra);
        container.appendChild(barraFundo);

        return container;
    }

    _criarTextarea() {
        const textarea = document.createElement('textarea');
        textarea.id = 'input-excel';
        textarea.placeholder = 'Cole aqui: Atend. [TAB] Paciente [TAB] Sessões';
        Object.assign(textarea.style, {
            width: '100%',
            height: '90px',
            background: '#2c3e50',
            color: 'white',
            border: '1px solid #34495e',
            fontSize: '11px',
            padding: '8px',
            marginBottom: '10px',
            boxSizing: 'border-box',
            flexShrink: '0',
            borderRadius: '4px',
            fontFamily: 'monospace',
            resize: 'none'
        });
        return textarea;
    }

    _criarStatusBox() {
        const box = document.createElement('div');
        box.id = 'status-box';
        Object.assign(box.style, {
            flex: '1',
            overflowY: 'auto',
            marginBottom: '10px',
            padding: '10px',
            background: '#000',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#2ecc71',
            borderRadius: '4px',
            borderLeft: '3px solid #2ecc71',
            lineHeight: '1.4'
        });
        box.textContent = 'Aguardando dados...';
        return box;
    }

    _criarAvisoRecuperacao() {
        const aviso = document.createElement('div');
        aviso.id = 'aviso-recuperacao';
        Object.assign(aviso.style, {
            display: 'none',
            marginBottom: '10px',
            padding: '12px',
            background: '#e67e22',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center',
            flexShrink: '0'
        });

        const titulo = document.createElement('div');
        titulo.textContent = '⚠️ Processo interrompido!';
        Object.assign(titulo.style, {
            fontWeight: '600',
            marginBottom: '4px'
        });
        aviso.appendChild(titulo);

        this.avisoDetalhe = document.createElement('div');
        this.avisoDetalhe.id = 'aviso-detalhe';
        Object.assign(this.avisoDetalhe.style, {
            marginBottom: '8px',
            fontSize: '10px'
        });
        aviso.appendChild(this.avisoDetalhe);

        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'flex';
        botoesDiv.style.gap = '8px';
        botoesDiv.style.justifyContent = 'center';

        const btnRetomar = document.createElement('button');
        btnRetomar.id = 'btn-retomar';
        btnRetomar.textContent = '▶ RETOMAR';
        Object.assign(btnRetomar.style, {
            padding: '8px 16px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
        });
        botoesDiv.appendChild(btnRetomar);

        const btnDescartar = document.createElement('button');
        btnDescartar.id = 'btn-descartar';
        btnDescartar.textContent = '✕ Descartar';
        Object.assign(btnDescartar.style, {
            padding: '8px 16px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
        });
        botoesDiv.appendChild(btnDescartar);
        aviso.appendChild(botoesDiv);

        return aviso;
    }

    _criarIndicadores(mesRef) {
        const div = document.createElement('div');
        Object.assign(div.style, {
            marginBottom: '10px',
            fontSize: '11px',
            color: '#95a5a6',
            textAlign: 'center',
            flexShrink: '0',
            padding: '8px',
            background: '#16202a',
            borderRadius: '4px'
        });

        const span1 = document.createElement('span');
        span1.title = 'Internet';
        span1.innerHTML = '🌐 <span id="inet-status">✅</span>';
        div.appendChild(span1);

        div.appendChild(document.createTextNode(' | '));

        const span2 = document.createElement('span');
        span2.title = 'TASY';
        span2.innerHTML = '🖥️ <span id="tasy-status">✅</span>';
        div.appendChild(span2);

        div.appendChild(document.createTextNode(' | '));

        const span3 = document.createElement('span');
        span3.title = 'Mês de Referência';
        span3.innerHTML = `📅 <span id="mes-ref" style="color:#f39c12;font-weight:500;">${mesRef}</span>`;
        div.appendChild(span3);

        return div;
    }

    _criarBotoesControle() {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.flexShrink = '0';

        const btnStart = document.createElement('button');
        btnStart.id = 'start-btn';
        btnStart.textContent = '▶ EXECUTAR';
        Object.assign(btnStart.style, {
            flex: '3',
            padding: '14px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(39,174,96,0.3)'
        });
        div.appendChild(btnStart);

        const btnPause = document.createElement('button');
        btnPause.id = 'pause-btn';
        btnPause.textContent = '⏸';
        Object.assign(btnPause.style, {
            flex: '1.5',
            padding: '14px',
            background: '#f39c12',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            transition: 'all 0.2s'
        });
        btnPause.disabled = true;
        btnPause.style.opacity = '0.5';
        div.appendChild(btnPause);

        const btnStop = document.createElement('button');
        btnStop.id = 'stop-btn';
        btnStop.textContent = '⏹';
        Object.assign(btnStop.style, {
            flex: '1.5',
            padding: '14px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            transition: 'all 0.2s'
        });
        btnStop.disabled = true;
        btnStop.style.opacity = '0.5';
        div.appendChild(btnStop);

        // Botão Modo Fiscal
        const btnFiscal = document.createElement('button');
        btnFiscal.id = 'fiscal-btn';
        btnFiscal.textContent = '🔍 FISCAL';
        Object.assign(btnFiscal.style, {
            flex: '1.5',
            padding: '14px',
            background: '#8e44ad',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '11px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(142,68,173,0.3)'
        });
        div.appendChild(btnFiscal);

        // Efeito hover nos botões de controle
        [btnStart, btnPause, btnStop, btnFiscal].forEach((btn) => {
            btn.addEventListener('mouseenter', () => (btn.style.filter = 'brightness(1.15)'));
            btn.addEventListener('mouseleave', () => (btn.style.filter = 'brightness(1)'));
        });

        return div;
    }

    _abrirModalConfig() {
        if (!this.configFormContainer || !this.painelConfig) return;

        // Remove estilos de ocultação do painel original
        this.painelConfig.style.display = 'block';
        this.painelConfig.style.opacity = '1';
        this.painelConfig.style.maxHeight = 'none';
        this.painelConfig.style.overflow = 'visible';

        // Remove o título "Configurações" duplicado
        const tituloOriginal = this.painelConfig.querySelector('div:first-child');
        if (tituloOriginal && tituloOriginal.textContent.includes('Configurações')) {
            tituloOriginal.style.display = 'none';
        }

        // Remove os botões originais (serão recriados no modal)
        const botoesOriginais = this.painelConfig.querySelectorAll(
            '#btn-salvar-config, #btn-fechar-config'
        );
        botoesOriginais.forEach((btn) => btn.remove());

        // Adiciona novos botões Salvar e Fechar diretamente no painelConfig
        const botoesDiv = document.createElement('div');
        botoesDiv.style.display = 'flex';
        botoesDiv.style.gap = '8px';
        botoesDiv.style.marginTop = '12px';

        const btnSalvar = document.createElement('button');
        btnSalvar.textContent = 'Salvar';
        Object.assign(btnSalvar.style, {
            flex: '1',
            padding: '8px',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500'
        });
        btnSalvar.addEventListener('click', () => {
            this.callbacks.onConfigSave(); // chama salvarConfigUI
        });
        botoesDiv.appendChild(btnSalvar);

        const btnFechar = document.createElement('button');
        btnFechar.textContent = 'Fechar';
        Object.assign(btnFechar.style, {
            flex: '1',
            padding: '8px',
            background: '#7f8c8d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '500'
        });
        btnFechar.addEventListener('click', () => {
            this.modalConfig.style.display = 'none';
            // Restaura o painelConfig ao corpo e re-aplica estilos de ocultação
            this.painelConfig.style.display = 'none';
            this.painelConfig.style.opacity = '0';
            this.painelConfig.style.maxHeight = '0';
            this.painelConfig.style.overflow = 'hidden';
            if (!this.corpo.contains(this.painelConfig)) {
                this.corpo.appendChild(this.painelConfig);
            }
        });
        botoesDiv.appendChild(btnFechar);

        this.painelConfig.appendChild(botoesDiv);

        // Limpa o container do modal e insere o painelConfig
        this.configFormContainer.innerHTML = '';
        this.configFormContainer.appendChild(this.painelConfig);

        // Exibe o modal
        this.modalConfig.style.display = 'block';
    }

    // ==================== VINCULAÇÃO DE EVENTOS ====================
    _vincularEventos() {
        this._addListener('start-btn', 'click', () => this.callbacks.onStart());
        this._addListener('pause-btn', 'click', () => this.callbacks.onPause());
        this._addListener('stop-btn', 'click', () => this.callbacks.onStop());
        this._addListener('fiscal-btn', 'click', () => this.callbacks.onFiscal());
        this._addListener('btn-perf', 'click', () => this._togglePainel(this.painelPerformance));

        this._addListener('btn-config', 'click', () => this._abrirModalConfig());

        // ← MUDOU: dashboard sempre recalculado ao abrir; log de erros idem.
        // Antes o painel ficava preso em "Carregando..." ou desatualizado.
        this._addListener('btn-stats', 'click', () => {
            this._togglePainel(this.painelStats);
            if (this.callbacks.onStats) this.callbacks.onStats();
        });
        this._addListener('btn-errors', 'click', () => {
            this._togglePainel(this.painelErrors);
            if (this.callbacks.onErrors) this.callbacks.onErrors();
        });

        this._addListener('btn-minimizar', 'click', () => this._minimizarPainel());

        this._addListener('btn-salvar-config', 'click', () => this.callbacks.onConfigSave());
        this._addListener('btn-fechar-config', 'click', () => {
            this.painelConfig.style.display = 'none';
        });

        this._addListener('btn-export-errors', 'click', () => this.callbacks.onExportErrors());
        this._addListener('btn-clear-errors', 'click', () => {
            if (confirm('Deseja limpar todos os erros registrados?')) {
                this.callbacks.onClearErrors();
            }
        });

        // Recuperação (retomar/descartar)
        this._addListener('btn-retomar', 'click', () => this.callbacks.onRetomar());
        this._addListener('btn-descartar', 'click', () => this.callbacks.onDescartar());
    }

    _addListener(elementId, event, handler) {
        const el = document.getElementById(elementId);
        if (el) {
            el.addEventListener(event, handler);
            this.listeners.push({ element: el, event, handler });
        }
    }

    _togglePainel(painel) {
        if (!painel) return;
        if (painel.style.display === 'block') {
            painel.style.opacity = '0';
            painel.style.maxHeight = '0';
            painel.style.overflow = 'hidden';
            painel.style.transition = 'opacity 0.2s, max-height 0.2s';
            setTimeout(() => {
                painel.style.display = 'none';
            }, 200);
        } else {
            painel.style.display = 'block';
            painel.style.opacity = '0';
            painel.style.maxHeight = '0';
            painel.style.overflow = 'hidden';
            painel.style.transition = 'opacity 0.2s, max-height 0.2s';
            requestAnimationFrame(() => {
                painel.style.opacity = '1';
                painel.style.maxHeight = '300px';
            });
        }
    }

    _minimizarPainel() {
        if (!this.painel) return;
        // Oculta o painel principal
        this.painel.style.display = 'none';

        // Cria o botão flutuante (se ainda não existir)
        if (!this.miniBtn) {
            this.miniBtn = document.createElement('button');
            this.miniBtn.textContent = '🤖';
            this.miniBtn.title = 'Abrir Agente TASY';
            Object.assign(this.miniBtn.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: '100001',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#2ecc71',
                color: 'white',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s, background 0.2s'
            });
            this.miniBtn.addEventListener('mouseenter', () => {
                this.miniBtn.style.transform = 'scale(1.1)';
                this.miniBtn.style.background = '#27ae60';
            });
            this.miniBtn.addEventListener('mouseleave', () => {
                this.miniBtn.style.transform = 'scale(1)';
                this.miniBtn.style.background = '#2ecc71';
            });
            this.miniBtn.addEventListener('click', () => {
                this.painel.style.display = 'flex';
                if (this.miniBtn) {
                    this.miniBtn.remove();
                    this.miniBtn = null;
                }
            });
            document.body.appendChild(this.miniBtn);
        }
    }

    // ==================== ARRASTAR ====================
    _tornarArrastavel(header) {
        let isDragging = false,
            offsetX,
            offsetY;

        const onMouseDown = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            isDragging = true;
            offsetX = e.clientX - this.painel.offsetLeft;
            offsetY = e.clientY - this.painel.offsetTop;
            header.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            let left = e.clientX - offsetX;
            let top = e.clientY - offsetY;
            left = Math.max(0, Math.min(left, window.innerWidth - this.painel.offsetWidth));
            top = Math.max(0, Math.min(top, window.innerHeight - this.painel.offsetHeight));
            this.painel.style.left = left + 'px';
            this.painel.style.top = top + 'px';
            this.painel.style.right = 'auto';
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        };

        header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        this.listeners.push(
            { element: header, event: 'mousedown', handler: onMouseDown },
            { element: document, event: 'mousemove', handler: onMouseMove },
            { element: document, event: 'mouseup', handler: onMouseUp }
        );
    }

    // ==================== MÉTODOS DE ATUALIZAÇÃO PÚBLICOS ====================

    atualizarBotoes(executando, pausado) {
        const fiscalBtn = document.getElementById('fiscal-btn');
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        if (!startBtn || !pauseBtn || !stopBtn) return;

        if (!executando) {
            startBtn.textContent = '▶ EXECUTAR';
            startBtn.style.background = '#27ae60';
            startBtn.style.boxShadow = '0 2px 8px rgba(39,174,96,0.3)';
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            pauseBtn.textContent = '⏸';
            pauseBtn.style.background = '#f39c12';
            pauseBtn.disabled = true;
            pauseBtn.style.opacity = '0.5';
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
            if (fiscalBtn) {
                fiscalBtn.disabled = false;
                fiscalBtn.style.opacity = '1';
            }
        } else if (pausado) {
            startBtn.textContent = '▶ RETOMAR';
            startBtn.style.background = '#2980b9';
            startBtn.style.boxShadow = '0 2px 8px rgba(41,128,185,0.3)';
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            pauseBtn.textContent = '⏸ PAUSADO';
            pauseBtn.style.background = '#7f8c8d';
            pauseBtn.disabled = true;
            pauseBtn.style.opacity = '0.5';
            stopBtn.disabled = false;
            stopBtn.style.opacity = '1';
            if (fiscalBtn) {
                fiscalBtn.disabled = true;
                fiscalBtn.style.opacity = '0.5';
            }
        } else {
            startBtn.textContent = '▶ EXECUTANDO...';
            startBtn.style.background = '#7f8c8d';
            startBtn.style.boxShadow = 'none';
            startBtn.disabled = true;
            startBtn.style.opacity = '0.7';
            pauseBtn.textContent = '⏸ PAUSAR';
            pauseBtn.style.background = '#f39c12';
            pauseBtn.disabled = false;
            pauseBtn.style.opacity = '1';
            stopBtn.disabled = false;
            stopBtn.style.opacity = '1';
            if (fiscalBtn) {
                fiscalBtn.disabled = true;
                fiscalBtn.style.opacity = '0.5';
            }
        }
    }

    atualizarStatusUI(mensagem, tipo = 'info') {
        if (!this.statusBox) return;
        const prefixos = {
            sucesso: '✅',
            erro: '❌',
            info: 'ℹ️',
            debug: '🔍',
            warning: '⚠️'
        };
        const prefixo = prefixos[tipo] || 'ℹ️';

        const linha = document.createElement('div');
        // ← MUDOU: textContent já escapa HTML. A sanitização anterior
        // corrompia entidades ("&lt;" aparecia literal na tela).
        linha.textContent = `${prefixo} ${mensagem}`;
        linha.style.marginBottom = '2px';
        this.statusBox.appendChild(linha);
        this.statusBox.scrollTop = this.statusBox.scrollHeight;

        while (this.statusBox.children.length > 500) {
            this.statusBox.removeChild(this.statusBox.children[0]);
        }
    }

    atualizarProgresso(atual, total) {
        if (!this.progressoContainer) return;
        this.progressoContainer.style.display = 'block';
        const percentual = total > 0 ? Math.round((atual / total) * 100) : 0;
        if (this.progressoBarra) this.progressoBarra.style.width = percentual + '%';
        if (this.progressoTexto)
            this.progressoTexto.textContent = `${atual}/${total} (${percentual}%)`;
    }

    esconderProgresso() {
        if (this.progressoContainer) this.progressoContainer.style.display = 'none';
    }

    atualizarDashboard(statsHtml) {
        const conteudo = document.getElementById('stats-conteudo');
        if (conteudo) conteudo.innerHTML = statsHtml;
    }

    atualizarPerformance(perfData, relatorio) {
        const tempoDecorrido = Math.round((Date.now() - perfData.inicioLote) / 1000);
        const sucessos = relatorio.sucesso.length;
        const pendencias = relatorio.pendencia.length;
        const processados = sucessos + pendencias + relatorio.pulado.length;
        const media =
            perfData.pacientes.length > 0
                ? (
                      perfData.pacientes.reduce((s, p) => s + p.tempoTotal, 0) /
                      perfData.pacientes.length
                  ).toFixed(1)
                : '--';
        const gargalo = '--'; // podemos calcular a etapa mais lenta depois

        // Atualiza métricas
        const setMetrica = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        };
        setMetrica('perf-tempo-decorrido', `${tempoDecorrido}s`);
        setMetrica('perf-processados', processados);
        setMetrica('perf-sucessos', sucessos);
        setMetrica('perf-pendencias', pendencias);
        setMetrica('perf-media', `${media}s`);
        setMetrica('perf-gargalo', gargalo);

        // Atualiza gráfico de barras
        const graficoDiv = document.getElementById('perf-grafico');
        if (!graficoDiv) return;
        graficoDiv.innerHTML = '';
        if (perfData.pacientes.length === 0) {
            graficoDiv.textContent = 'Nenhum paciente processado ainda.';
            return;
        }
        const maxTempo = Math.max(...perfData.pacientes.map((p) => p.tempoTotal), 1);
        perfData.pacientes.slice(-20).forEach((p) => {
            const barraContainer = document.createElement('div');
            barraContainer.style.cssText = 'display:flex;align-items:center;margin-bottom:4px;';

            const label = document.createElement('span');
            label.textContent = p.paciente.substring(0, 15).padEnd(15, ' ');
            label.style.cssText = 'width:150px;color:#ecf0f1;';

            const barra = document.createElement('div');
            const largura = Math.round((p.tempoTotal / maxTempo) * 200);
            barra.style.cssText = `width:${largura}px;height:12px;background:#27ae60;border-radius:2px;margin-right:6px;`;
            if (p.tempoTotal > 20) barra.style.background = '#f39c12';
            if (p.tempoTotal > 40) barra.style.background = '#e74c3c';

            const tempoSpan = document.createElement('span');
            tempoSpan.textContent = `${p.tempoTotal}s`;
            tempoSpan.style.cssText = 'color:#95a5a6;font-size:10px;';

            barraContainer.appendChild(label);
            barraContainer.appendChild(barra);
            barraContainer.appendChild(tempoSpan);
            graficoDiv.appendChild(barraContainer);
        });
    }

    atualizarPainelErros(errosHtml) {
        const conteudo = document.getElementById('errors-conteudo');
        if (conteudo) conteudo.innerHTML = errosHtml;
    }

    mostrarPreview(html) {
        if (this.statusBox) this.statusBox.innerHTML = html;
    }

    mostrarBotoesExport() {
        if (!this.statusBox) return;
        const divBotoes = document.createElement('div');
        divBotoes.style.cssText = 'margin-top:15px;display:flex;gap:10px;';

        const btnExpRel = document.createElement('button');
        btnExpRel.textContent = '📥 Exportar Relatório';
        Object.assign(btnExpRel.style, {
            flex: '1',
            padding: '10px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
        });
        btnExpRel.addEventListener('click', () => this.callbacks.onExportRelatorio());
        divBotoes.appendChild(btnExpRel);

        const btnExpLog = document.createElement('button');
        btnExpLog.textContent = '📋 Exportar Log';
        Object.assign(btnExpLog.style, {
            flex: '1',
            padding: '10px',
            background: '#f39c12',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
        });
        btnExpLog.addEventListener('click', () => this.callbacks.onExportLog());
        divBotoes.appendChild(btnExpLog);

        // Botão de Exportar Log Técnico (roxo)
        const btnExpLogTec = document.createElement('button');
        btnExpLogTec.textContent = '📊 Exportar Log Técnico';
        Object.assign(btnExpLogTec.style, {
            flex: '1',
            padding: '10px',
            background: '#9b59b6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
        });
        btnExpLogTec.addEventListener('click', () => this.callbacks.onExportLogTecnico());
        divBotoes.appendChild(btnExpLogTec);

        this.statusBox.appendChild(divBotoes);
    }

    mostrarAvisoRecuperacao(ultimoRegistro, indice, total) {
        if (this.avisoRecuperacao && this.avisoDetalhe) {
            this.avisoRecuperacao.style.display = 'block';
            this.avisoDetalhe.textContent = `Último: ${ultimoRegistro} [${indice + 1}/${total}]`;
        }
    }

    esconderAvisoRecuperacao() {
        if (this.avisoRecuperacao) this.avisoRecuperacao.style.display = 'none';
    }

    /**
     * Remove o painel, botão flutuante e todos os listeners.
     */
    destroy() {
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners = [];

        if (this.miniBtn) {
            this.miniBtn.remove();
            this.miniBtn = null;
        }

        if (this.painel) this.painel.remove();
        if (this.modalConfig) this.modalConfig.remove();
    }
}
