// logUI.js
'use strict';

import { SecurityUtils } from './securityUtils.js';

/**
 * Painel de log detalhado (diário).
 * Exibe entradas de log em tempo real, com filtro por tipo e busca textual.
 */
export class LogUI {
    constructor() {
        this.painel = null;
        this.listaContainer = null;
        this.badgeErros = null;
        this.filtroAtivo = 'todos'; // 'todos' | 'erro' | 'sucesso' | 'info' | 'warning' | 'debug'
        this.termoBusca = '';
        this.entradas = []; // array de { timestamp, tipo, mensagem }
        this.autoScroll = true;
        this.visivel = false;
        this.listeners = [];
    }

    /**
     * Cria o painel de log e o insere no body, oculto inicialmente.
     */
    criarPainel() {
        if (document.getElementById('log-ui-painel')) return;

        // Container principal
        this.painel = document.createElement('div');
        this.painel.id = 'log-ui-painel';
        Object.assign(this.painel.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '450px',
            height: '400px',
            background: '#1e272e',
            color: 'white',
            borderRadius: '10px',
            border: '2px solid #3498db',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            zIndex: '100002',
            display: 'none',
            flexDirection: 'column',
            fontFamily: 'monospace',
            fontSize: '12px',
            overflow: 'hidden'
        });

        // Cabeçalho
        const header = this._criarHeader();
        this.painel.appendChild(header);

        // Barra de filtros e busca
        const barra = this._criarBarraFiltros();
        this.painel.appendChild(barra);

        // Lista de entradas
        this.listaContainer = document.createElement('div');
        this.listaContainer.id = 'log-lista';
        Object.assign(this.listaContainer.style, {
            flex: '1',
            overflowY: 'auto',
            padding: '8px',
            background: '#16202a',
            margin: '0 8px 8px 8px',
            borderRadius: '4px',
            lineHeight: '1.5'
        });
        this.listaContainer.addEventListener('scroll', () => {
            const pertoDoFim =
                this.listaContainer.scrollHeight -
                    this.listaContainer.scrollTop -
                    this.listaContainer.clientHeight <
                30;
            this.autoScroll = pertoDoFim;
        });
        this.painel.appendChild(this.listaContainer);

        document.body.appendChild(this.painel);
    }

    _criarHeader() {
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            background: '#2d3436',
            borderRadius: '8px 8px 0 0',
            flexShrink: '0'
        });

        const titulo = document.createElement('span');
        titulo.textContent = '📋 Diário de Execução';
        titulo.style.fontWeight = '600';
        titulo.style.color = '#3498db';
        header.appendChild(titulo);

        const grupoBotoes = document.createElement('div');
        grupoBotoes.style.display = 'flex';
        grupoBotoes.style.gap = '8px';
        grupoBotoes.style.alignItems = 'center';

        // Badge de erros
        this.badgeErros = document.createElement('span');
        this.badgeErros.textContent = '0';
        Object.assign(this.badgeErros.style, {
            background: '#e74c3c',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 7px',
            fontSize: '10px',
            fontWeight: 'bold',
            display: 'none'
        });
        grupoBotoes.appendChild(this.badgeErros);

        // Botão limpar
        const btnLimpar = document.createElement('button');
        btnLimpar.textContent = 'Limpar';
        Object.assign(btnLimpar.style, {
            background: '#7f8c8d',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px'
        });
        btnLimpar.addEventListener('click', () => this.limparLog());
        grupoBotoes.appendChild(btnLimpar);

        // Botão fechar
        const btnFechar = document.createElement('button');
        btnFechar.textContent = '✕';
        Object.assign(btnFechar.style, {
            background: 'none',
            border: 'none',
            color: '#e74c3c',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '0 4px'
        });
        btnFechar.addEventListener('click', () => this.esconder());
        grupoBotoes.appendChild(btnFechar);

        header.appendChild(grupoBotoes);
        return header;
    }

    _criarBarraFiltros() {
        const barra = document.createElement('div');
        Object.assign(barra.style, {
            display: 'flex',
            gap: '6px',
            padding: '6px 12px',
            flexShrink: '0',
            alignItems: 'center',
            flexWrap: 'wrap'
        });

        const tipos = [
            { valor: 'todos', label: 'Todos' },
            { valor: 'erro', label: '❌ Erros' },
            { valor: 'sucesso', label: '✅ Sucesso' },
            { valor: 'info', label: 'ℹ️ Info' },
            { valor: 'warning', label: '⚠️ Warning' },
            { valor: 'debug', label: '🔍 Debug' }
        ];

        tipos.forEach((t) => {
            const btn = document.createElement('button');
            btn.textContent = t.label;
            Object.assign(btn.style, {
                background: this.filtroAtivo === t.valor ? '#3498db' : '#2c3e50',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                transition: 'background 0.2s'
            });
            btn.addEventListener('click', () => {
                this.filtroAtivo = t.valor;
                this._atualizarFiltrosBotoes();
                this._renderizarLista();
            });
            btn.dataset.tipo = t.valor;
            barra.appendChild(btn);
        });

        // Campo de busca
        const inputBusca = document.createElement('input');
        inputBusca.type = 'text';
        inputBusca.placeholder = '🔍 Buscar...';
        Object.assign(inputBusca.style, {
            flex: '1',
            background: '#2c3e50',
            color: 'white',
            border: '1px solid #7f8c8d',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            minWidth: '100px'
        });
        inputBusca.addEventListener('input', (e) => {
            this.termoBusca = e.target.value.toLowerCase();
            this._renderizarLista();
        });
        barra.appendChild(inputBusca);

        return barra;
    }

    _atualizarFiltrosBotoes() {
        const botoes = this.painel.querySelectorAll('button[data-tipo]');
        botoes.forEach((btn) => {
            btn.style.background = btn.dataset.tipo === this.filtroAtivo ? '#3498db' : '#2c3e50';
        });
    }

    /**
     * Adiciona uma entrada de log e re-renderiza a lista.
     * @param {object} entry - { timestamp, tipo, mensagem }
     */
    adicionarEntrada(entry) {
        this.entradas.push(entry);
        if (this.entradas.length > 1000) this.entradas.shift();
        if (this.visivel) this._renderizarLista();
        this._atualizarBadge();
    }

    /**
     * Renderiza a lista de entradas de acordo com filtro e busca.
     */
    _renderizarLista() {
        if (!this.listaContainer) return;

        let entradasFiltradas = this.entradas;
        if (this.filtroAtivo !== 'todos') {
            entradasFiltradas = entradasFiltradas.filter((e) => e.tipo === this.filtroAtivo);
        }
        if (this.termoBusca) {
            entradasFiltradas = entradasFiltradas.filter(
                (e) =>
                    e.mensagem.toLowerCase().includes(this.termoBusca) ||
                    e.tipo.toLowerCase().includes(this.termoBusca)
            );
        }

        this.listaContainer.innerHTML = '';
        if (entradasFiltradas.length === 0) {
            const vazio = document.createElement('div');
            vazio.textContent = 'Nenhuma entrada encontrada.';
            vazio.style.color = '#7f8c8d';
            vazio.style.padding = '20px';
            vazio.style.textAlign = 'center';
            this.listaContainer.appendChild(vazio);
            return;
        }

        const cores = {
            erro: '#e74c3c',
            sucesso: '#2ecc71',
            info: '#3498db',
            warning: '#f39c12',
            debug: '#9b59b6'
        };

        entradasFiltradas.forEach((entry) => {
            const linha = document.createElement('div');
            const hora = new Date(entry.timestamp).toLocaleTimeString('pt-BR');
            const cor = cores[entry.tipo] || '#ecf0f1';
            const tipoFormatado = entry.tipo.toUpperCase().padEnd(7);

            linha.innerHTML = `<span style="color:#7f8c8d;">${hora}</span> <span style="color:${cor};font-weight:bold;">[${tipoFormatado}]</span> ${SecurityUtils.sanitizeHTML(entry.mensagem)}`;
            linha.style.marginBottom = '3px';
            linha.style.borderBottom = '1px solid #2c3e50';
            linha.style.paddingBottom = '3px';
            this.listaContainer.appendChild(linha);
        });

        if (this.autoScroll) {
            this.listaContainer.scrollTop = this.listaContainer.scrollHeight;
        }
    }

    _atualizarBadge() {
        if (!this.badgeErros) return;
        const qtdErros = this.entradas.filter((e) => e.tipo === 'erro').length;
        if (qtdErros > 0) {
            this.badgeErros.textContent = qtdErros;
            this.badgeErros.style.display = 'inline';
        } else {
            this.badgeErros.style.display = 'none';
        }
    }

    limparLog() {
        this.entradas = [];
        if (this.visivel) this._renderizarLista();
        this._atualizarBadge();
    }

    mostrar() {
        if (!this.painel) this.criarPainel();
        this.painel.style.display = 'flex';
        this.visivel = true;
        this._renderizarLista();
    }

    esconder() {
        if (this.painel) this.painel.style.display = 'none';
        this.visivel = false;
    }

    toggle() {
        if (this.visivel) {
            this.esconder();
        } else {
            this.mostrar();
        }
    }

    destroy() {
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners = [];
        if (this.painel) this.painel.remove();
    }
}
