// agenteCore.js
'use strict';

import { CONSTANTES } from './constants.js';
import { SecurityUtils } from './securityUtils.js';
import { ErrorHandler } from './errorHandler.js';
import { StorageManager } from './storageManager.js';
import { DOMCache } from './domCache.js';
import { exportarRelatorioPDF } from './relatorioPDF.js';
import { Debouncer } from './debouncer.js';
import { CONFIG_PADRAO } from './config.js';
import { UIPainel } from './uiPainel.js';
import { LogUI } from './logUI.js';
import { trocarAtendimentoPeloHeader, localizarEAbrirBPA, primeiroFluxo } from './navegacao.js';
import { executarAgente4 } from './executorAgente4.js';
import {
    salvarEstatisticas,
    gerarDashboardHTML,
    exportarRelatorioCSV,
    exportarLogTecnicoCSV,
    exportarDiarioCSV
} from './relatorio.js';
import { tocarBeep, notificar } from './notificacoes.js';
import { CONFIG_SCHEMA } from './configSchema.js';

export class AgenteTASY {
    constructor() {
        this.errorHandler = new ErrorHandler();
        this.storage = new StorageManager(this.errorHandler);
        this.domCache = new DOMCache();
        this.debouncer = new Debouncer();
        this.executando = false;
        this.pausado = false;
        this.primeiroAtendimento = true;
        this.contadorPacientesDesdeReset = 0;
        this.relatorio = { sucesso: [], pendencia: [], pulado: [] };
        this.diario = [];
        this.historicoLatencia = [];
        this.registrosTecnicos = [];
        this.pacienteAtual = { nome: '', atend: '' };
        this.dataAltaAtual = null;
        this.performanceData = {
            pacientes: [],
            inicioLote: null,
            fimLote: null,
            tempoTotalLote: 0
        };
        this.config = { ...CONFIG_PADRAO };
        this.carregarConfig();
        this.inicioProcessamento = null;
        this.totalPacientes = 0;
        this.ui = null;
        this.logUI = new LogUI();
    }

    carregarConfig() {
        const configSalva = this.storage.carregar(CONSTANTES.KEYS.CONFIG);
        if (configSalva) {
            this.config = { ...CONFIG_PADRAO, ...configSalva };
        }
    }

    salvarConfig() {
        this.storage.salvar(CONSTANTES.KEYS.CONFIG, this.config);
    }

    atualizarConfig(novaConfig) {
        this.config = { ...this.config, ...novaConfig };
        this.salvarConfig();
    }

    registrarLatencia(ms) {
        this.historicoLatencia.push(ms);
        if (this.historicoLatencia.length > CONSTANTES.LATENCIA.HISTORICO_MAX) {
            this.historicoLatencia.shift();
        }
    }

    calcularFatorDinamico() {
        if (!this.config.tempoDinamico || this.historicoLatencia.length === 0) return 1.0;
        const media =
            this.historicoLatencia.reduce((a, b) => a + b, 0) / this.historicoLatencia.length;
        let fator = media / CONSTANTES.LATENCIA.NORMAL;
        if (this.config.safeMode) {
            fator = Math.max(
                CONSTANTES.LATENCIA.FATOR_SAFE_MIN,
                Math.min(CONSTANTES.LATENCIA.FATOR_SAFE_MAX, fator)
            );
        } else {
            fator = Math.max(
                CONSTANTES.LATENCIA.FATOR_MIN,
                Math.min(CONSTANTES.LATENCIA.FATOR_MAX, fator)
            );
        }
        return fator;
    }

    async esperar(tempoBase = null) {
        const tempo = tempoBase || this.config.tempo;
        const fator = this.calcularFatorDinamico();
        let ms = Math.round(tempo * fator);
        if (this.config.safeMode) ms += CONSTANTES.TEMPOS.SAFE_MODE_EXTRA;
        if (this.config.debug) this.log(`⏱️ Espera ${ms}ms (fator ${fator.toFixed(2)})`, 'debug');
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    log(mensagem, tipo = 'info') {
        const timestamp = new Date();
        const entry = {
            timestamp: timestamp.toISOString(),
            mensagem: SecurityUtils.sanitizeText(mensagem),
            tipo
        };
        this.diario.push(entry);
        if (this.diario.length > 1000) this.diario.shift();
        if (this.config.debug) console.log(`[${entry.timestamp}] [${tipo}] ${mensagem}`);
        if (this.ui) this.ui.atualizarStatusUI(mensagem, tipo);
        if (this.logUI) this.logUI.adicionarEntrada(entry);
    }

    logTecnico(evento, resultado, detalhe = '') {
        const agora = new Date();
        this.registrosTecnicos.push({
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR'),
            paciente: this.pacienteAtual.nome || this.pacienteAtual.atend || '-',
            atendimento: this.pacienteAtual.atend || '-',
            evento: SecurityUtils.sanitizeText(evento),
            resultado,
            detalhe: SecurityUtils.sanitizeText(detalhe)
        });
    }

    salvarEstado(dados, indice) {
        const estado = {
            dados,
            indice,
            relatorio: {
                sucesso: this.relatorio.sucesso.map((r) => ({
                    texto: r.texto,
                    timestamp: r.timestamp?.toISOString?.() || null
                })),
                pendencia: this.relatorio.pendencia.map((r) => ({
                    texto: r.texto,
                    timestamp: r.timestamp?.toISOString?.() || null
                })),
                pulado: this.relatorio.pulado.map((r) => ({
                    texto: r.texto,
                    timestamp: r.timestamp?.toISOString?.() || null
                }))
            },
            timestamp: new Date().toISOString(),
            versao: CONSTANTES.VERSAO
        };
        this.storage.salvar(CONSTANTES.KEYS.ESTADO, estado);
    }

    carregarEstado() {
        const estado = this.storage.carregar(CONSTANTES.KEYS.ESTADO);
        if (!estado) return null;
        if (estado.relatorio) {
            estado.relatorio.sucesso = (estado.relatorio.sucesso || []).map((item) => ({
                texto: item.texto || item,
                timestamp: item.timestamp ? new Date(item.timestamp) : null
            }));
            estado.relatorio.pendencia = (estado.relatorio.pendencia || []).map((item) => ({
                texto: item.texto || item,
                timestamp: item.timestamp ? new Date(item.timestamp) : null
            }));
            estado.relatorio.pulado = (estado.relatorio.pulado || []).map((item) => ({
                texto: item.texto || item,
                timestamp: item.timestamp ? new Date(item.timestamp) : null
            }));
        }
        return estado;
    }

    limparEstado() {
        this.storage.remover(CONSTANTES.KEYS.ESTADO);
    }

    validarDados(dados) {
        const resultado = {
            total: dados.length,
            validos: 0,
            invalidos: 0,
            duplicados: 0,
            avisos: [],
            dadosLimpos: []
        };
        const atendimentosVistos = new Set();

        dados.forEach((item, index) => {
            let valido = true;
            const atend = SecurityUtils.sanitizeText(item.atend);
            const paciente = SecurityUtils.sanitizeText(item.paciente);
            const sessoesRaw = item.sessoes;

            if (!SecurityUtils.validarAtendimento(atend)) {
                resultado.avisos.push(
                    `⚠️ Linha ${index + 2}: Atendimento inválido "${SecurityUtils.sanitizeHTML(atend)}" será removido`
                );
                resultado.invalidos++;
                valido = false;
            }

            let sessoes = NaN;
            if (
                sessoesRaw !== undefined &&
                sessoesRaw !== null &&
                String(sessoesRaw).trim() !== ''
            ) {
                const parsed = parseInt(sessoesRaw);
                if (!isNaN(parsed)) sessoes = parsed;
            }

            if (isNaN(sessoes)) {
                resultado.avisos.push(
                    `⚠️ Linha ${index + 2}: Sessões vazias ou inválidas — ajustado para 0`
                );
                sessoes = 0;
                valido = false;
                resultado.invalidos++;
            } else if (!SecurityUtils.validarSessoes(sessoes)) {
                resultado.avisos.push(
                    `⚠️ Linha ${index + 2}: Sessões fora do intervalo (0-${CONSTANTES.VALIDACAO.MAX_SESSOES}) — ajustado para 0`
                );
                sessoes = 0;
            }

            if (atendimentosVistos.has(atend)) {
                resultado.avisos.push(
                    `⚠️ Linha ${index + 2}: Atendimento duplicado "${SecurityUtils.sanitizeHTML(atend)}" será removido`
                );
                resultado.duplicados++;
                valido = false;
            }

            atendimentosVistos.add(atend);

            if (valido) {
                resultado.validos++;
                resultado.dadosLimpos.push({
                    atend,
                    sessoes: Math.min(sessoes, CONSTANTES.VALIDACAO.MAX_SESSOES),
                    paciente
                });
            }
        });

        return resultado;
    }

    async aguardarSePausado() {
        while (this.pausado && this.executando) {
            await new Promise((r) => setTimeout(r, CONSTANTES.TEMPOS.CHECK_PAUSA));
        }
    }

    pausar() {
        if (!this.executando) return;
        this.pausado = true;
        this.log('⏸️ Execução pausada', 'info');
        if (this.ui) this.ui.atualizarBotoes(this.executando, this.pausado);
    }

    retomar() {
        if (!this.executando || !this.pausado) return;
        this.pausado = false;
        this.log('▶️ Execução retomada', 'info');
        if (this.ui) this.ui.atualizarBotoes(this.executando, this.pausado);
    }

    parar() {
        this.executando = false;
        this.pausado = false;
        this.limparEstado();
        this.log('⏹️ Execução encerrada', 'info');
        if (this.ui) this.ui.atualizarBotoes(this.executando, this.pausado);
        SecurityUtils.rateLimiter.reset();
    }

    async verificarCircuitBreaker(errosConsecutivos) {
        if (!this.config.circuitBreakerAtivo) return;
        if (errosConsecutivos >= this.config.circuitBreakerMaxErros) {
            this.log(
                `🛑 Circuit Breaker ativado: ${errosConsecutivos} erros consecutivos. Pausando...`,
                'erro'
            );
            this.pausar();
            tocarBeep(this.config, this.errorHandler);
        }
    }

    async verificarPausaProgramada(contadorPacientes) {
        if (!this.config.pausaProgramadaAtiva) return;
        if (contadorPacientes >= this.config.pausaProgramadaIntervalo) {
            this.log(
                `⏸️ Pausa programada: ${this.config.pausaProgramadaDuracao / 1000}s de descanso...`,
                'info'
            );
            this.pausar();

            await new Promise((r) => setTimeout(r, this.config.pausaProgramadaDuracao / 2));
            this.domCache.clear();
            this.log('🧹 Cache do DOM limpo durante pausa.', 'info');
            await new Promise((r) => setTimeout(r, this.config.pausaProgramadaDuracao / 2));

            if (this.executando) this.retomar();
        }
    }

    getBotaoAdicionar() {
        return this.domCache.get('btnAdicionar', () => {
            return Array.from(document.querySelectorAll('button')).find(
                (b) =>
                    b.innerText.trim() === 'Adicionar' &&
                    b.getBoundingClientRect().width > 0 &&
                    !b.className.includes('is-in-popup')
            );
        });
    }

    obterDataAltaCabecalho() {
        const campos = Array.from(
            document.querySelectorAll('.tasy-personbar-field, .person-bar-field')
        );

        for (const campo of campos) {
            const labelEl = campo.querySelector('.person-bar-field-label');
            const infoEl = campo.querySelector(
                '.person-bar-field-info, .person-bar-field-info-text'
            );

            if (!labelEl || !infoEl) continue;

            const label = (labelEl.textContent || '').trim().toUpperCase();
            const valor = (infoEl.textContent || '').trim();

            if (/\bDATA\s*ALTA\b|\bALTA\b|\bFALECIMENTO\b|\bÓBITO\b|\bFALECIDO\b/i.test(label)) {
                const match = valor.match(
                    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/
                );
                if (match) {
                    const dia = parseInt(match[1], 10);
                    const mes = parseInt(match[2], 10) - 1;
                    const ano = parseInt(match[3], 10);
                    const hora = match[4] ? parseInt(match[4], 10) : 23;
                    const minuto = match[5] ? parseInt(match[5], 10) : 59;
                    const segundo = match[6] ? parseInt(match[6], 10) : 59;
                    const dataAlta = new Date(ano, mes, dia, hora, minuto, segundo);
                    this.log(
                        `📅 Data de alta/falecimento encontrada: ${dataAlta.toLocaleString('pt-BR')}`,
                        'info'
                    );
                    return dataAlta;
                }
            }
        }
        return null;
    }

    getBotao(texto) {
        const chave = `btn_${texto}`;
        return this.domCache.get(chave, () => {
            return Array.from(document.querySelectorAll('button, span, a')).find(
                (x) =>
                    x.innerText.trim().toUpperCase() === texto.toUpperCase() &&
                    x.getBoundingClientRect().width > 0
            );
        });
    }

    getSalvar() {
        return this.domCache.get('btnSalvar', () => {
            return Array.from(document.querySelectorAll('div.wbutton-container')).find(
                (el) =>
                    el.querySelector('.wbutton-text')?.innerText.trim() === 'Salvar' &&
                    el.getBoundingClientRect().width > 0 &&
                    el.className.includes('enable')
            );
        });
    }

    getQuantidadeLinha(row) {
        const celula = row.querySelector('div.slick-cell.l8.r8');
        if (!celula) return 1;
        const texto = celula.innerText.trim();
        const valor = parseInt(texto);
        return isNaN(valor) ? 1 : valor;
    }

    getDataProcedimentoLinha(row) {
        const celula = row.querySelector('div.slick-cell.l5.r5');
        if (!celula) return null;
        const texto = celula.innerText
            .trim()
            .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
        const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!match) return null;
        const dia = parseInt(match[1]);
        const mes = parseInt(match[2]) - 1;
        const ano = parseInt(match[3]);
        return new Date(ano, mes, dia);
    }

    getUltimoDiaMes() {
        const hoje = new Date();
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        return mesAnterior.getDate();
    }

    _popupMotivoExclusaoVisivel() {
        const painelId = CONSTANTES.ID_PAINEL;

        const candidatos = Array.from(
            document.querySelectorAll('.dialog-box.dialog-default, .dialog-box')
        ).filter((el) => {
            if (el.closest('#' + painelId)) return false;
            if (el.classList.contains('ng-hide') || el.closest('.ng-hide')) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 100) return false;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            return true;
        });

        const comMotivo = candidatos.find((el) => /Motivo\s*exclus[aã]o/i.test(el.innerText || ''));
        return comMotivo || null;
    }

    async _aguardarElementoSumir(el, timeoutMs = 5000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            if (!document.contains(el)) return true;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return true;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')
                return true;
            await new Promise((r2) => setTimeout(r2, 80));
        }
        return false;
    }

    async _clicarComEventosReais(el) {
        el.focus();
        await new Promise((r) => setTimeout(r, 80));
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        el.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            })
        );
        el.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y })
        );
        el.dispatchEvent(
            new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            })
        );
        el.dispatchEvent(
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y })
        );
        el.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })
        );
    }

    async _aguardarPrimeiroOkExclusao(timeoutMs = 8000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return null;
            const btn = document.querySelector('button.dialog_ok_button.btn-blue');
            if (btn && !btn.disabled && btn.getBoundingClientRect().width > 0) {
                return btn;
            }
            await new Promise((r) => setTimeout(r, 120));
        }
        return null;
    }

    async aguardarBotaoOkMotivoExclusao(timeoutMs = 10000) {
        const inicio = Date.now();
        const POLL_MS = 100;
        const ESTAVEL_MS = 200;

        let estavelDesde = null;
        let ultimaAssinatura = '';

        this.log('⏳ Aguardando pop-up de motivo ficar pronto...', 'debug');

        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return null;
            await this.aguardarSePausado();

            const campoMotivo = document.querySelector('input[name="DS_COMPL_MOTIVO_EXCON"]');
            const popupMotivo = this._popupMotivoExclusaoVisivel();

            const focoOk =
                campoMotivo &&
                document.activeElement === campoMotivo &&
                campoMotivo.getBoundingClientRect().width > 0;

            const btnOk = popupMotivo
                ? Array.from(popupMotivo.querySelectorAll('button')).find(
                      (b) =>
                          b.innerText.trim().toUpperCase() === 'OK' &&
                          !b.disabled &&
                          b.getBoundingClientRect().width > 0
                  )
                : null;

            const assinatura = `${focoOk}|${!!btnOk}`;

            if (focoOk && btnOk) {
                if (assinatura === ultimaAssinatura) {
                    if (!estavelDesde) estavelDesde = Date.now();
                    if (Date.now() - estavelDesde >= ESTAVEL_MS) {
                        this.log(
                            `✅ Pop-up de motivo pronto (${Date.now() - inicio}ms)`,
                            'sucesso'
                        );
                        return btnOk;
                    }
                } else {
                    estavelDesde = null;
                }
            } else {
                estavelDesde = null;
            }

            ultimaAssinatura = assinatura;
            await new Promise((r) => setTimeout(r, POLL_MS));
        }

        this.log(`⏱️ Timeout aguardando pop-up de motivo (${timeoutMs}ms)`, 'erro');
        return null;
    }

    async excluirProcedimentoExcedente(tipoProcedimento) {
        const vp = this.getViewportProcedimentos?.() || this.getViewportPrincipal();
        if (!vp) return false;

        const rows = Array.from(vp.querySelectorAll('div.ui-widget-content.slick-row'));
        const linhasDoTipo = [];

        rows.forEach((row, index) => {
            const txt = this.limparTexto(row.innerText || '');
            let ehDoTipo = false;

            if (tipoProcedimento === 'consulta') {
                ehDoTipo =
                    /CONSULTA MEDICA EM ATEN/.test(txt) || /AVALIACAO MENSAL DO MEDICO/.test(txt);
            } else if (tipoProcedimento === 'medicacao') {
                ehDoTipo =
                    txt.includes('ADMINISTRACAO DE MEDICAMENTOS') || txt.includes('301100012');
            }

            if (!ehDoTipo) return;

            const data = this.getDataProcedimentoLinha(row);
            if (data) {
                linhasDoTipo.push({ row, index, data, txt });
            }
        });

        if (linhasDoTipo.length === 0) {
            this.log('⚠️ Nenhum procedimento do tipo excedente encontrado', 'erro');
            return false;
        }

        const datas = linhasDoTipo.map((l) => l.data.getTime());
        const temRepetida = datas.length !== new Set(datas).size;

        let alvo;
        if (temRepetida) {
            const contagem = {};
            datas.forEach((d) => (contagem[d] = (contagem[d] || 0) + 1));
            const dataRepetida = Object.keys(contagem).find((d) => contagem[d] > 1);
            const repetidas = linhasDoTipo.filter(
                (l) => l.data.getTime() === parseInt(dataRepetida)
            );
            alvo = repetidas[0];
            this.log(
                `🔍 Data repetida encontrada: ${alvo.data.toLocaleDateString('pt-BR')}. Excluindo uma ocorrência.`,
                'info'
            );
        } else {
            const ultimoDia = this.getUltimoDiaMes();
            linhasDoTipo.forEach((l) => {
                l.distanciaFimMes = Math.abs(l.data.getDate() - ultimoDia);
            });
            linhasDoTipo.sort((a, b) => a.distanciaFimMes - b.distanciaFimMes);
            alvo = linhasDoTipo[0];
            this.log(
                `🔍 Nenhuma data repetida. Excluindo procedimento mais próximo do fim do mês: ${alvo.data.toLocaleDateString('pt-BR')}`,
                'info'
            );
        }

        alvo.row.click();
        await this.esperar(300);

        const btnExcluir = Array.from(
            document.querySelectorAll('button.ng-scope.handlebar-button')
        ).find((b) => b.innerText.trim() === 'Excluir' && b.getBoundingClientRect().width > 0);
        if (!btnExcluir) {
            this.log('⚠️ Botão Excluir não encontrado', 'erro');
            return false;
        }
        btnExcluir.click();

        const btnConfirmar = await this._aguardarPrimeiroOkExclusao(8000);
        if (!btnConfirmar) {
            this.log('⚠️ Botão OK do primeiro pop-up não apareceu', 'erro');
            return false;
        }

        btnConfirmar.click();
        this.log('✅ Primeiro pop-up confirmado. Aguardando segundo pop-up...', 'info');

        const sumiu1 = await this._aguardarElementoSumir(btnConfirmar, 5000);
        if (!sumiu1) {
            this.log(
                '⚠️ Primeiro pop-up não sumiu após clique — continuando mesmo assim',
                'warning'
            );
        } else {
            this.log('✅ Primeiro pop-up sumiu', 'debug');
        }

        const btnMotivo = await this.aguardarBotaoOkMotivoExclusao(10000);
        if (!btnMotivo) {
            this.log('⚠️ Segundo pop-up (motivo) não apareceu em 10s', 'erro');
            return false;
        }

        if (
            document.activeElement &&
            (document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'INPUT')
        ) {
            document.activeElement.blur();
            await this.esperar(150);
            this.log('✅ Foco removido da caixa de texto', 'info');
        }

        await this._clicarComEventosReais(btnMotivo);

        let sumiu2 = await this._aguardarElementoSumir(btnMotivo, 6000);

        if (!sumiu2) {
            this.log('⚠️ Segundo pop-up não sumiu — retentando clique', 'warning');
            await this.esperar(300);
            await this._clicarComEventosReais(btnMotivo);
            sumiu2 = await this._aguardarElementoSumir(btnMotivo, 5000);
        }

        if (!sumiu2) {
            this.log('❌ Segundo pop-up não fechou após duas tentativas', 'erro');
            this.logTecnico('Excluir excedente', 'erro', 'Segundo pop-up persistiu');
            return false;
        }

        this.log('✅ Segundo pop-up (motivo) confirmado', 'sucesso');
        this.logTecnico(
            'Excluir excedente',
            'sucesso',
            `Excluído: ${alvo.txt.substring(0, 40)} (data: ${alvo.data.toLocaleDateString('pt-BR')})`
        );
        return true;
    }

    getViewportPrincipal() {
        return this.domCache.get('viewportPrincipal', () => {
            const todos = Array.from(document.querySelectorAll('.slick-viewport-top')).filter(
                (el) => el.scrollHeight > 100 && el.getBoundingClientRect().width > 0
            );
            return todos[1] || todos[0];
        });
    }

    getViewportProcedimentos() {
        const viewports = Array.from(document.querySelectorAll('.slick-viewport')).filter(
            (vp) => vp.scrollHeight > 100 && vp.getBoundingClientRect().width > 0
        );
        for (const vp of viewports) {
            const primeiraLinha = vp.querySelector('div.ui-widget-content.slick-row');
            if (primeiraLinha && primeiraLinha.querySelector('div.slick-cell.l8.r8')) {
                this.log(`🔍 Viewport de procedimentos encontrada: ${vp.className}`, 'debug');
                return vp;
            }
        }
        this.log('⚠️ Viewport de procedimentos não encontrada, usando fallback', 'warning');
        return this.getViewportPrincipal();
    }

    limparTexto(txt) {
        return SecurityUtils.normalizar(txt);
    }

    _registrarPerformance(item, tempoTotalMs) {
        if (!this.performanceData) return;

        const tempoSegundos = (tempoTotalMs / 1000).toFixed(1);
        const pacienteInfo = {
            paciente: item.paciente || item.atend,
            atend: item.atend,
            tempoTotal: parseFloat(tempoSegundos),
            timestamp: new Date()
        };

        this.performanceData.pacientes.push(pacienteInfo);

        if (
            this.ui &&
            this.ui.painelPerformance &&
            this.ui.painelPerformance.style.display === 'block'
        ) {
            this.ui.atualizarPerformance(this.performanceData, this.relatorio);
        }
    }

    async aguardarBotaoAdicionarDisponivel(timeoutMs = 20000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return false;
            const btn = this.getBotaoAdicionar();
            if (btn && btn.getBoundingClientRect().width > 0 && !btn.disabled) {
                return true;
            }
            this.domCache.clear();
            await new Promise((r) => setTimeout(r, 200));
        }
        return false;
    }

    async aguardarCampoCodigoDisponivel(timeoutMs = 10000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return null;
            const inputs = Array.from(document.querySelectorAll('input[type="text"]')).filter(
                (el) => el.getBoundingClientRect().width > 0
            );
            const campo = inputs[1] || inputs[0];
            if (campo) return campo;
            await new Promise((r) => setTimeout(r, 150));
        }
        return null;
    }

    async aguardarJanelaProcedimentoPronta(timeoutMs = 10000) {
        const inicio = Date.now();
        const POLL_MS = 100;
        const ESTAVEL_MS = 300;

        let estavelDesde = null;
        let ultimaAssinatura = '';

        this.log('⏳ Aguardando janela de procedimento ficar pronta...', 'debug');

        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return false;
            await this.aguardarSePausado();

            const campoSeq = document.querySelector('input[name="NR_SEQ_PROC_INTERNO"]');
            const campoData = document.querySelector('input[name="DT_PROCEDIMENTO"]');

            const focoOk =
                campoSeq &&
                document.activeElement === campoSeq &&
                campoSeq.getBoundingClientRect().width > 0;

            const dataOk =
                campoData &&
                campoData.getBoundingClientRect().width > 0 &&
                (campoData.value || '').trim() !== '';

            const assinatura = `${focoOk}|${dataOk}|${campoData?.value || ''}`;

            if (focoOk && dataOk) {
                if (assinatura === ultimaAssinatura) {
                    if (!estavelDesde) estavelDesde = Date.now();
                    if (Date.now() - estavelDesde >= ESTAVEL_MS) {
                        this.log(
                            `✅ Janela de procedimento pronta (${Date.now() - inicio}ms)`,
                            'sucesso'
                        );
                        return true;
                    }
                } else {
                    estavelDesde = null;
                }
            } else {
                estavelDesde = null;
            }

            ultimaAssinatura = assinatura;
            await new Promise((r) => setTimeout(r, POLL_MS));
        }

        this.log(`⏱️ Timeout aguardando janela de procedimento (${timeoutMs}ms)`, 'erro');
        return false;
    }

    async aguardarViewportCarregar() {
        this.log('⏳ Aguardando carregamento da viewport...', 'info');
        const inicio = performance.now();
        for (let i = 0; i < 20; i++) {
            const vp = this.getViewportPrincipal();
            if (vp) {
                const linhas = Array.from(vp.querySelectorAll('div.ui-widget-content.slick-row'));
                if (linhas.some((row) => row.innerText.trim().length > 5)) {
                    this.registrarLatencia(performance.now() - inicio);
                    this.log('✅ Viewport carregada', 'sucesso');
                    return true;
                }
            }
            await this.esperar(500);
        }
        this.log('⚠️ Viewport não carregou a tempo', 'erro');
        return false;
    }

    async fecharPopupsErro() {
        let fechou = false;
        const modaisErro = Array.from(
            document.querySelectorAll('.priority-dialog, .modal, .popup')
        ).filter((el) => el.getBoundingClientRect().width > 0);
        for (let modal of modaisErro) {
            const btnOk = Array.from(
                modal.querySelectorAll('button, div[role="button"], span')
            ).find((b) => b.innerText.trim().toUpperCase() === 'OK');
            if (btnOk) {
                btnOk.click();
                await this.esperar(800);
                fechou = true;
                break;
            }
        }
        if (!fechou) {
            const btnsOk = Array.from(
                document.querySelectorAll('button, div[role="button"], span')
            ).filter(
                (b) =>
                    b.innerText.trim().toUpperCase() === 'OK' &&
                    b.getBoundingClientRect().width > 0 &&
                    !b.closest(`#${CONSTANTES.ID_PAINEL}`)
            );
            if (btnsOk.length > 0) {
                btnsOk[btnsOk.length - 1].click();
                await this.esperar(800);
                fechou = true;
            }
        }
        if (fechou) this.log('✅ Pop-up de erro fechado', 'sucesso');
        return fechou;
    }

    async fecharPopupProcedimento() {
        const btnCancelar = Array.from(document.querySelectorAll('button')).find(
            (b) =>
                b.innerText.trim().toUpperCase() === 'CANCELAR' &&
                b.getBoundingClientRect().width > 0 &&
                !b.closest(`#${CONSTANTES.ID_PAINEL}`)
        );
        if (btnCancelar) {
            btnCancelar.click();
            await this.esperar(600);
            return true;
        }
        return false;
    }

    _popupBloqueador() {
        const painelId = CONSTANTES.ID_PAINEL;

        if (document.documentElement.classList.contains('ngdialog-open'))
            return 'html.ngdialog-open';
        if (document.body.classList.contains('ngdialog-open')) return 'body.ngdialog-open';

        const overlays = Array.from(document.querySelectorAll('.ngdialog-overlay')).filter((el) => {
            if (el.closest('#' + painelId)) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 200 || r.height < 150) return false;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')
                return false;
            return !el.classList.contains('ng-hide') && !el.closest('.ng-hide');
        });
        if (overlays.length > 0) return 'overlay-visivel';

        const schematics = Array.from(
            document.querySelectorAll(
                '.schematic-external-access-modal, .external-access-dialog-box'
            )
        ).filter((el) => {
            if (el.closest('#' + painelId)) return false;
            if (el.classList.contains('ng-hide') || el.closest('.ng-hide')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 200 && r.height > 150;
        });
        if (schematics.length > 0) return 'schematic-visivel';

        return null;
    }

    _clicarFecharNgDialog() {
        const painelId = CONSTANTES.ID_PAINEL;

        const containers = [
            ...Array.from(
                document.querySelectorAll('.schematic-external-access-modal:not(.ng-hide)')
            ),
            ...Array.from(document.querySelectorAll('.external-access-dialog-box:not(.ng-hide)')),
            ...Array.from(document.querySelectorAll('.ngdialog-content:not(.ng-hide)')),
            ...Array.from(document.querySelectorAll('.ngdialog:not(.ng-hide)'))
        ].filter((el) => {
            if (el.closest('#' + painelId)) return false;
            const r = el.getBoundingClientRect();
            return r.width > 100 && r.height > 80;
        });

        const seletorBtn = 'button, [role="button"]';

        for (const c of containers) {
            const botoes = Array.from(c.querySelectorAll(seletorBtn));
            const btn = botoes.find(
                (b) =>
                    b.innerText.trim().toUpperCase() === 'FECHAR' &&
                    b.getBoundingClientRect().width > 0
            );
            if (btn) {
                btn.click();
                return true;
            }
        }

        const btnFora = Array.from(document.querySelectorAll(seletorBtn)).find(
            (b) =>
                b.innerText.trim().toUpperCase() === 'FECHAR' &&
                b.getBoundingClientRect().width > 0 &&
                !b.closest('#' + painelId)
        );
        if (btnFora) {
            btnFora.click();
            return true;
        }

        return false;
    }

    _assinaturaEstado() {
        const ngOpen = document.body.classList.contains('ngdialog-open') ? 1 : 0;
        const nModais = document.querySelectorAll('.ngdialog:not(.ng-hide)').length;
        const vp = document.querySelector('.slick-viewport-top, .slick-viewport');
        let hash = 0;
        if (vp) {
            const txt = (vp.textContent || '').slice(0, 300);
            for (let i = 0; i < txt.length; i++) {
                hash = ((hash << 5) - hash + txt.charCodeAt(i)) | 0;
            }
        }
        return `${ngOpen}|${nModais}|${hash}`;
    }

    async aguardarContaPronta(timeoutMs = 15000) {
        const inicio = Date.now();
        const ESTAVEL_NORMAL_MS = 2500;
        const ESTAVEL_POS_POPUP_MS = 500;
        const POLL_MS = 80;
        const ESPERA_BOTAO_MS = 5000;
        const MAX_FECHAMENTOS = 5;

        let estavelDesde = null;
        let ultimaAssinatura = '';
        let popupFechado = false;
        let qtdFechamentos = 0;

        this.log('⏳ Aguardando conta ficar pronta...', 'info');

        while (Date.now() - inicio < timeoutMs) {
            if (!this.executando) return false;
            await this.aguardarSePausado();

            const bloqueador = this._popupBloqueador();

            if (bloqueador) {
                const inicioBotao = Date.now();
                let clicou = false;

                while (Date.now() - inicioBotao < ESPERA_BOTAO_MS) {
                    if (!this.executando) return false;
                    await this.aguardarSePausado();

                    if (!this._popupBloqueador()) {
                        this.log('ℹ️ Pop-up fechou sozinho durante espera', 'info');
                        popupFechado = true;
                        clicou = true;
                        break;
                    }

                    if (this._clicarFecharNgDialog()) {
                        qtdFechamentos++;
                        popupFechado = true;
                        clicou = true;
                        this.log(
                            `✅ Pop-up fechado (${qtdFechamentos}) — bloqueador: ${bloqueador}`,
                            'sucesso'
                        );
                        break;
                    }

                    await new Promise((r) => setTimeout(r, 150));
                }

                if (!clicou) {
                    if (qtdFechamentos >= MAX_FECHAMENTOS) {
                        this.log(`⚠️ Pop-up reapareceu ${qtdFechamentos}x — desistindo`, 'erro');
                        return false;
                    }
                    this.log(
                        `⚠️ Bloqueador "${bloqueador}" persiste há ${ESPERA_BOTAO_MS}ms sem botão Fechar`,
                        'warning'
                    );
                    await new Promise((r) => setTimeout(r, 300));
                    continue;
                }

                const inicioFechamento = Date.now();
                while (Date.now() - inicioFechamento < 3000) {
                    if (!this.executando) return false;
                    if (!this._popupBloqueador()) break;
                    await new Promise((r) => setTimeout(r, 80));
                }

                estavelDesde = null;
                ultimaAssinatura = '';
                continue;
            }

            const assinatura = this._assinaturaEstado();
            if (assinatura === ultimaAssinatura) {
                if (!estavelDesde) estavelDesde = Date.now();
                const limiar = popupFechado ? ESTAVEL_POS_POPUP_MS : ESTAVEL_NORMAL_MS;
                if (Date.now() - estavelDesde >= limiar) {
                    this.log(
                        `✅ Conta pronta em ${Date.now() - inicio}ms${popupFechado ? ' (após pop-up)' : ''}`,
                        'sucesso'
                    );
                    return true;
                }
            } else {
                estavelDesde = null;
            }
            ultimaAssinatura = assinatura;

            await new Promise((r) => setTimeout(r, POLL_MS));
        }

        this.log(`⏱️ Timeout aguardando conta pronta (${timeoutMs}ms)`, 'erro');
        return false;
    }

    getDataProcedimento() {
        const hoje = new Date();
        const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        const dia = mesAnterior.getDate().toString().padStart(2, '0');
        const mes = (mesAnterior.getMonth() + 1).toString().padStart(2, '0');
        const ano = mesAnterior.getFullYear();
        return `${dia}${mes}${ano}235959`;
    }

    getDataProcedimentoEfetiva() {
        const dataPadrao = this.getDataProcedimento();

        if (!this.dataAltaAtual) return dataPadrao;

        const diaPadrao = parseInt(dataPadrao.substring(0, 2), 10);
        const mesPadrao = parseInt(dataPadrao.substring(2, 4), 10) - 1;
        const anoPadrao = parseInt(dataPadrao.substring(4, 8), 10);
        const dataPadraoDate = new Date(anoPadrao, mesPadrao, diaPadrao);

        if (this.dataAltaAtual <= dataPadraoDate) {
            const dia = this.dataAltaAtual.getDate().toString().padStart(2, '0');
            const mes = (this.dataAltaAtual.getMonth() + 1).toString().padStart(2, '0');
            const ano = this.dataAltaAtual.getFullYear();
            const hora = this.dataAltaAtual.getHours().toString().padStart(2, '0');
            const minuto = this.dataAltaAtual.getMinutes().toString().padStart(2, '0');
            const segundo = this.dataAltaAtual.getSeconds().toString().padStart(2, '0');
            return `${dia}${mes}${ano}${hora}${minuto}${segundo}`;
        }

        return dataPadrao;
    }

    async alterarDataProcedimento() {
        const dataAlvo = this.getDataProcedimentoEfetiva();
        const inputData = document.querySelector('input[name="DT_PROCEDIMENTO"]');
        if (!inputData) {
            this.log('⚠️ Campo data não encontrado', 'erro');
            return false;
        }
        inputData.focus();
        inputData.click();
        await this.esperar(300);
        inputData.select();
        inputData.value = '';
        inputData.dispatchEvent(new Event('input', { bubbles: true }));
        inputData.dispatchEvent(new Event('change', { bubbles: true }));
        inputData.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
        inputData.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Delete' }));
        await this.esperar(200);
        inputData.value = dataAlvo;
        inputData.dispatchEvent(new Event('input', { bubbles: true }));
        inputData.dispatchEvent(new Event('change', { bubbles: true }));
        inputData.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 })
        );
        inputData.dispatchEvent(
            new KeyboardEvent('keypress', { bubbles: true, key: 'Enter', keyCode: 13 })
        );
        inputData.dispatchEvent(
            new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', keyCode: 13 })
        );
        inputData.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        await this.esperar(400);
        this.log(`📅 Data alterada para ${dataAlvo}`, 'sucesso');
        return true;
    }

    async alterarQuantidade(qtd) {
        if (qtd <= 1) return true;
        const inputQtd = document.querySelector('input[name="QT_PROCEDIMENTO"]');
        if (!inputQtd) {
            this.log('⚠️ Campo Quantidade não encontrado', 'erro');
            return false;
        }
        inputQtd.focus();
        inputQtd.click();
        await this.esperar(150);
        inputQtd.select();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await this.esperar(100);
        document.execCommand('insertText', false, String(qtd));
        inputQtd.dispatchEvent(new Event('input', { bubbles: true }));
        inputQtd.dispatchEvent(new Event('change', { bubbles: true }));
        await this.esperar(300);
        this.log(`🔢 Quantidade alterada para ${qtd}`, 'sucesso');
        return true;
    }

    async salvarProcedimento() {
        const btnSalvar = this.getSalvar();
        if (!btnSalvar) {
            this.log('❌ Salvar não encontrado', 'erro');
            return false;
        }

        btnSalvar.click();

        const fechouPopup = await this.aguardarFechamentoPopupProcedimento();
        if (!fechouPopup) {
            this.log('⚠️ Popup de procedimento não fechou a tempo (possível travamento)', 'erro');
            this.logTecnico('Salvar procedimento', 'erro', 'Popup não fechou a tempo');
            await this.fecharPopupsErro();
            return false;
        }

        this.domCache.clear();

        const botaoOk = await this.aguardarBotaoAdicionarDisponivel();
        if (!botaoOk) {
            this.log('⚠️ Botão Adicionar não voltou a tempo após salvar', 'erro');
            this.logTecnico('Salvar procedimento', 'erro', 'Botão Adicionar não voltou a tempo');
            return false;
        }

        await this.fecharPopupsErro();
        this.log('💾 Procedimento salvo e confirmado na tela', 'sucesso');
        this.logTecnico('Salvar procedimento', 'sucesso');
        return true;
    }

    async aguardarFechamentoPopupProcedimento(timeoutMs = 20000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            const abaProcedimento = Array.from(document.querySelectorAll('div.wtab')).find((el) => {
                const label = el.querySelector('.wtab-label, .ng-binding');
                return (
                    label &&
                    label.innerText.trim() === 'Procedimento' &&
                    el.getBoundingClientRect().width > 0
                );
            });
            if (!abaProcedimento) return true;
            await new Promise((r) => setTimeout(r, 300));
        }
        return false;
    }

    async contarTodosProcedimentos() {
        const vp = this.getViewportPrincipal();
        if (!vp) {
            this.log('⚠️ Viewport não encontrado para contagem', 'erro');
            return null;
        }

        const vistasConsultas = new Set();
        const vistasMedicacoes = new Set();
        let temNutricao = false,
            temPsicologia = false,
            temSocial = false,
            temEnfermagem = false;

        const alturaTotal = vp.scrollHeight;
        const alturaVisivel = vp.clientHeight;
        const passo = Math.round(alturaVisivel * 0.8);

        const coletar = () => {
            const linhas = Array.from(vp.querySelectorAll('div.ui-widget-content.slick-row'));
            linhas.forEach((row) => {
                const chave = row.getAttribute('data-row-idx') || row.style.top;
                if (chave === null || chave === undefined || chave === '') return;

                const txt = this.limparTexto(row.innerText || '');

                const ehConsulta =
                    /CONSULTA MEDICA EM ATEN/.test(txt) || /AVALIACAO MENSAL DO MEDICO/.test(txt);
                if (ehConsulta) vistasConsultas.add(chave);

                if (txt.includes('ADMINISTRACAO DE MEDICAMENTOS') || txt.includes('301100012')) {
                    vistasMedicacoes.add(chave);
                }
                if (txt.includes('AVALIACAO MENSAL DE NUTRICAO')) temNutricao = true;
                if (txt.includes('AVALIACAO MENSAL DE PSICOLOGIA')) temPsicologia = true;
                if (txt.includes('AVALIACAO MENSAL DO SERVICO SOCIAL')) temSocial = true;
                if (txt.includes('AVALIACAO MENSAL DE ENFERMAGEM')) temEnfermagem = true;
            });
        };

        for (let passada = 0; passada < 2; passada++) {
            let pos = 0;
            while (pos <= alturaTotal) {
                if (!this.executando) return null;
                await this.aguardarSePausado();
                vp.scrollTop = pos;
                await new Promise((r) => setTimeout(r, 150));
                coletar();
                pos += passo;
            }
            vp.scrollTop = 0;
            await new Promise((r) => setTimeout(r, 200));
        }

        return {
            qtdConsulta: vistasConsultas.size,
            qtdMedicacao: vistasMedicacoes.size,
            temNutricao,
            temPsicologia,
            temSocial,
            temEnfermagem
        };
    }

    async contarTodosProcedimentosFiscal() {
        let vp = null;
        const todos = Array.from(document.querySelectorAll('.slick-viewport-top')).filter(
            (el) => el.scrollHeight > 100 && el.getBoundingClientRect().width > 0
        );
        for (const v of todos) {
            const primeiraLinha = v.querySelector('div.ui-widget-content.slick-row');
            if (primeiraLinha && primeiraLinha.querySelector('div.slick-cell.l8.r8')) {
                vp = v;
                break;
            }
        }
        if (!vp) vp = this.getViewportPrincipal();

        if (!vp) {
            this.log('⚠️ Viewport não encontrado para contagem fiscal', 'erro');
            return null;
        }

        const vistasConsultas = new Map();
        const vistasMedicacoes = new Map();
        let temNutricao = false,
            temPsicologia = false,
            temSocial = false,
            temEnfermagem = false;

        const alturaTotal = vp.scrollHeight;
        const alturaVisivel = vp.clientHeight;
        const passo = Math.round(alturaVisivel * 0.8);

        const coletar = () => {
            const linhas = Array.from(vp.querySelectorAll('div.ui-widget-content.slick-row'));
            linhas.forEach((row) => {
                const chave = row.getAttribute('data-row-idx') || row.style.top;
                if (chave === null || chave === undefined || chave === '') return;

                const txt = this.limparTexto(row.innerText || '');
                const qtd = this.getQuantidadeLinha(row);

                const ehConsulta =
                    /CONSULTA MEDICA EM ATEN/.test(txt) || /AVALIACAO MENSAL DO MEDICO/.test(txt);
                if (ehConsulta) vistasConsultas.set(chave, qtd);

                if (txt.includes('ADMINISTRACAO DE MEDICAMENTOS') || txt.includes('301100012')) {
                    vistasMedicacoes.set(chave, qtd);
                }
                if (txt.includes('AVALIACAO MENSAL DE NUTRICAO')) temNutricao = true;
                if (txt.includes('AVALIACAO MENSAL DE PSICOLOGIA')) temPsicologia = true;
                if (txt.includes('AVALIACAO MENSAL DO SERVICO SOCIAL')) temSocial = true;
                if (txt.includes('AVALIACAO MENSAL DE ENFERMAGEM')) temEnfermagem = true;
            });
        };

        for (let passada = 0; passada < 2; passada++) {
            let pos = 0;
            while (pos <= alturaTotal) {
                if (!this.executando) return null;
                await this.aguardarSePausado();
                vp.scrollTop = pos;
                await new Promise((r) => setTimeout(r, 150));
                coletar();
                pos += passo;
            }
            vp.scrollTop = 0;
            await new Promise((r) => setTimeout(r, 200));
        }

        let qtdConsulta = 0,
            qtdMedicacao = 0;
        vistasConsultas.forEach((q) => (qtdConsulta += q));
        vistasMedicacoes.forEach((q) => (qtdMedicacao += q));

        return { qtdConsulta, qtdMedicacao, temNutricao, temPsicologia, temSocial, temEnfermagem };
    }

    criarInterface() {
        if (document.getElementById(CONSTANTES.ID_PAINEL)) return;

        const mesRef = new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString(
            'pt-BR',
            { month: '2-digit', year: 'numeric' }
        );

        this.ui = new UIPainel({
            onStart: () => this.handleStart(),
            onPause: () => this.handlePause(),
            onStop: () => this.handleStop(),
            onConfigSave: () => this.salvarConfigUI(),
            onRetomar: () => this.retomarEstado(this.carregarEstado()),
            onDescartar: () => {
                this.limparEstado();
                if (this.ui) this.ui.esconderAvisoRecuperacao();
                this.log('🗑️ Estado anterior descartado', 'info');
            },
            onExportErrors: () => this.errorHandler.exportar(),
            onClearErrors: () => {
                this.errorHandler.clear();
                this._atualizarPainelErros();
            },
            onExportRelatorio: () =>
                exportarRelatorioCSV(
                    this.relatorio,
                    this.baixarArquivo.bind(this),
                    this.getTimestamp.bind(this)
                ),
            onExportLog: () =>
                exportarDiarioCSV(
                    this.diario,
                    this.baixarArquivo.bind(this),
                    this.getTimestamp.bind(this)
                ),
            onExportLogTecnico: () =>
                exportarLogTecnicoCSV(
                    this.registrosTecnicos,
                    this.baixarArquivo.bind(this),
                    this.getTimestamp.bind(this)
                ),
            onFiscal: () => this.handleFiscal(),
            onStats: () => this._atualizarDashboard(),
            onErrors: () => this._atualizarPainelErros()
        });

        this.ui.criarInterface(this.config, mesRef);

        this.logUI.criarPainel();
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.logUI.toggle();
            }
        });

        const estadoSalvo = this.carregarEstado();
        if (estadoSalvo && estadoSalvo.dados) {
            const ult = estadoSalvo.dados[estadoSalvo.indice];
            this.ui.mostrarAvisoRecuperacao(
                ult?.paciente || ult?.atend,
                estadoSalvo.indice,
                estadoSalvo.dados.length
            );
        }
    }

    _atualizarDashboard() {
        if (!this.ui) return;
        const html = gerarDashboardHTML(this.storage);
        this.ui.atualizarDashboard(html);
    }

    _atualizarPainelErros() {
        const erros = this.errorHandler.getErrors();
        let html = 'Nenhum erro registrado';
        if (erros.length > 0) {
            html = erros
                .slice(-20)
                .reverse()
                .map((erro) => {
                    const tempo = new Date(erro.timestamp).toLocaleTimeString('pt-BR');
                    const ctx = SecurityUtils.sanitizeHTML(erro.contexto);
                    const msg = SecurityUtils.sanitizeHTML(erro.message);
                    return `<div style="margin-bottom:8px;padding:6px;background:#16202a;border-radius:3px;border-left:2px solid #e74c3c;">
                    <div style="color:#e74c3c;font-weight:600;font-size:10px;">${tempo} - ${ctx}</div>
                    <div style="color:#ecf0f1;margin-top:2px;font-size:9px;">${msg}</div>
                </div>`;
                })
                .join('');
        }
        this.ui.atualizarPainelErros(html);
    }

    handleStart() {
        if (this.executando && this.pausado) {
            this.retomar();
            return;
        }
        if (this.executando) return;

        const texto = this.ui?.inputExcel?.value || '';
        const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
        if (linhas.length === 0) {
            this.log('❌ Lista vazia!', 'erro');
            return;
        }

        const dados = this.parsearDados(linhas);
        if (dados.length === 0) {
            this.log('❌ Nenhum atendimento válido encontrado!', 'erro');
            return;
        }

        const validacao = this.validarDados(dados);
        this.mostrarPreview(validacao, dados);
    }

    handleFiscal() {
        if (this.executando) {
            this.log('❌ Aguarde a execução atual terminar antes de iniciar o modo fiscal', 'erro');
            return;
        }

        const texto = this.ui?.inputExcel?.value || '';
        const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
        if (linhas.length === 0) {
            this.log('❌ Lista vazia! Cole os dados antes de iniciar o modo fiscal', 'erro');
            return;
        }

        const dados = this.parsearDados(linhas);
        if (dados.length === 0) {
            this.log('❌ Nenhum atendimento válido encontrado!', 'erro');
            return;
        }

        this.log('🔍 Iniciando MODO FISCAL - Auditoria de contas', 'info');
        this.log(`📋 ${dados.length} atendimentos serão auditados`, 'info');
        this.log('⚠️ O modo fiscal é SOMENTE LEITURA - nada será modificado', 'warning');

        this.executando = true;
        this.pausado = false;
        this.ui.atualizarBotoes(this.executando, this.pausado);
        this.executarAuditoria(dados);
    }

    async executarAuditoria(dados) {
        const resultados = [];
        let totalAuditados = 0;
        let totalOK = 0;
        let totalPendencias = 0;

        for (let i = 0; i < dados.length; i++) {
            if (!this.executando) break;
            await this.aguardarSePausado();

            const item = dados[i];
            this.pacienteAtual = { nome: item.paciente, atend: item.atend };
            this.log(
                `🔍 [${i + 1}/${dados.length}] Auditando ${item.paciente || item.atend}...`,
                'info'
            );

            try {
                let contaAberta = false;
                if (this.primeiroAtendimento || i === 0) {
                    this.log('🔎 Modo primeiro paciente...', 'info');
                    contaAberta = await primeiroFluxo(item.atend, this);
                    if (contaAberta) this.primeiroAtendimento = false;
                } else {
                    await this.fecharPopupsErro();
                    const trocou = await trocarAtendimentoPeloHeader(item.atend, this);
                    if (trocou) {
                        const pronto = await this.aguardarContaPronta(15000);
                        if (!pronto) {
                            this.log(
                                `⚠️ ${item.paciente || item.atend} — Conta não ficou pronta a tempo`,
                                'erro'
                            );
                            this.logTecnico('Auditoria Fiscal', 'erro', 'Conta não ficou pronta');
                            resultados.push({
                                paciente: item.paciente,
                                atend: item.atend,
                                status: 'Tela não pronta',
                                detalhes: ''
                            });
                            totalPendencias++;
                            continue;
                        }

                        if (!this.executando) break;

                        contaAberta = await localizarEAbrirBPA(this);
                    }
                }

                if (!contaAberta) {
                    this.log(`⏭️ ${item.paciente || item.atend} - BPA não encontrado`, 'erro');
                    this.logTecnico('Auditoria Fiscal', 'erro', 'BPA não encontrado');
                    resultados.push({
                        paciente: item.paciente,
                        atend: item.atend,
                        status: 'BPA não encontrado',
                        detalhes: ''
                    });
                    totalPendencias++;
                    continue;
                }

                await this.aguardarViewportCarregar();

                const contagem = await this.contarTodosProcedimentosFiscal();
                if (!contagem) {
                    this.log(`❌ ${item.paciente || item.atend} - Erro na contagem`, 'erro');
                    resultados.push({
                        paciente: item.paciente,
                        atend: item.atend,
                        status: 'Erro na contagem',
                        detalhes: ''
                    });
                    totalPendencias++;
                    continue;
                }

                const alvo = Math.min(item.sessoes || 13, 13);
                const pendencias = [];

                if (contagem.qtdConsulta < alvo)
                    pendencias.push(`Consultas: ${contagem.qtdConsulta}/${alvo}`);
                if (contagem.qtdMedicacao < alvo)
                    pendencias.push(`Medicações: ${contagem.qtdMedicacao}/${alvo}`);
                if (!contagem.temNutricao) pendencias.push('Nutrição ausente');
                if (!contagem.temPsicologia) pendencias.push('Psicologia ausente');
                if (!contagem.temSocial) pendencias.push('Serviço Social ausente');
                if (!contagem.temEnfermagem) pendencias.push('Enfermagem ausente');

                const tentarExcluir = async (tipo, nomeExibicao) => {
                    for (let tentativa = 1; tentativa <= 3; tentativa++) {
                        this.log(
                            `🔄 Tentativa ${tentativa}/3 de excluir ${nomeExibicao}...`,
                            'info'
                        );
                        const sucesso = await this.excluirProcedimentoExcedente(tipo);
                        if (sucesso) {
                            this.log(
                                `✅ ${nomeExibicao} excluído com sucesso na tentativa ${tentativa}.`,
                                'sucesso'
                            );
                            this.logTecnico(
                                `Exclusão de ${nomeExibicao}`,
                                'sucesso',
                                `Tentativa ${tentativa}`
                            );
                            return true;
                        }
                        this.log(`⚠️ Tentativa ${tentativa} falhou.`, 'erro');
                        await this.fecharPopupsErro();
                        await this.esperar(1000);
                    }
                    this.log(
                        `❌ Não foi possível excluir ${nomeExibicao} após 3 tentativas.`,
                        'erro'
                    );
                    this.logTecnico(
                        `Exclusão de ${nomeExibicao}`,
                        'erro',
                        'Falhou após 3 tentativas'
                    );
                    return false;
                };

                if (contagem.qtdConsulta > alvo) {
                    const excedente = contagem.qtdConsulta - alvo;
                    this.log(
                        `⚠️ Consultas excedentes: ${contagem.qtdConsulta}/${alvo} (${excedente} a mais)`,
                        'erro'
                    );
                    const excluiu = await tentarExcluir('consulta', 'Consulta');
                    if (!excluiu) {
                        pendencias.push(`Consulta excedente não removida (${excedente} a mais)`);
                    }
                }
                if (contagem.qtdMedicacao > alvo) {
                    const excedente = contagem.qtdMedicacao - alvo;
                    this.log(
                        `⚠️ Medicações excedentes: ${contagem.qtdMedicacao}/${alvo} (${excedente} a mais)`,
                        'erro'
                    );
                    const excluiu = await tentarExcluir('medicacao', 'Medicação');
                    if (!excluiu) {
                        pendencias.push(`Medicação excedente não removida (${excedente} a mais)`);
                    }
                }

                const status = pendencias.length === 0 ? 'OK' : 'Pendências';
                const detalhes =
                    pendencias.length > 0
                        ? pendencias.join('; ')
                        : 'Todos os procedimentos presentes';

                resultados.push({
                    paciente: item.paciente || item.atend,
                    atend: item.atend,
                    status,
                    detalhes
                });

                if (status === 'OK') {
                    this.log(`✅ ${item.paciente || item.atend} - AUDITADO COM SUCESSO`, 'sucesso');
                    this.logTecnico('Auditoria Fiscal', 'sucesso', 'Conta OK');
                    totalOK++;
                } else {
                    this.log(`⚠️ ${item.paciente || item.atend} - PENDÊNCIAS: ${detalhes}`, 'erro');
                    this.logTecnico('Auditoria Fiscal', 'pendencia', detalhes);
                    totalPendencias++;
                }

                totalAuditados++;
            } catch (erro) {
                this.errorHandler.log(erro, `auditoria: ${item.atend}`);
                this.log(`❌ Erro ao auditar ${item.atend}: ${erro.message}`, 'erro');
                resultados.push({
                    paciente: item.paciente,
                    atend: item.atend,
                    status: 'Erro',
                    detalhes: erro.message
                });
                totalPendencias++;
            }
        }

        this.executando = false;
        this.pausado = false;
        this.ui.atualizarBotoes(false, false);
        this.exibirRelatorioFiscal(resultados, totalAuditados, totalOK, totalPendencias);
    }

    exibirRelatorioFiscal(resultados, total, ok, pendencias) {
        this.log('═'.repeat(40), 'info');
        this.log('📊 RELATÓRIO DE AUDITORIA FISCAL', 'info');
        this.log(`Total auditado: ${total} | ✅ OK: ${ok} | ⚠️ Pendências: ${pendencias}`, 'info');
        this.log('═'.repeat(40), 'info');

        if (pendencias > 0) {
            this.log('⚠️ CONTAS COM PENDÊNCIAS:', 'erro');
            resultados
                .filter((r) => r.status !== 'OK')
                .forEach((r) => {
                    this.log(`  • ${r.paciente} (${r.atend}): ${r.detalhes}`, 'erro');
                });
        }

        if (ok > 0) {
            this.log('✅ CONTAS OK:', 'sucesso');
            resultados
                .filter((r) => r.status === 'OK')
                .forEach((r) => {
                    this.log(`  • ${r.paciente} (${r.atend})`, 'sucesso');
                });
        }

        this.logTecnico(
            'Auditoria Fiscal - Resumo',
            'info',
            `Total: ${total} | OK: ${ok} | Pendências: ${pendencias}`
        );
    }

    parsearDados(linhas) {
        const titulos = linhas[0].split(/\t/);
        const idxAtend = titulos.findIndex((t) => t.includes('Atend'));
        const idxSessoes = titulos.findIndex((t) => t.includes('Sessões') || t.includes('Sessoes'));
        const idxPaciente = titulos.findIndex((t) => t.includes('Paciente'));

        const dados = [];
        for (let i = 1; i < linhas.length; i++) {
            const col = linhas[i].split(/\t/);
            const atend = idxAtend >= 0 ? col[idxAtend]?.trim() : linhas[i].match(/\d{4,}/)?.[0];
            let sessoes = undefined;
            if (idxSessoes >= 0) {
                const raw = col[idxSessoes]?.trim();
                if (raw && /^\d+$/.test(raw)) {
                    sessoes = parseInt(raw) || 0;
                } else {
                    sessoes = undefined;
                }
            } else {
                sessoes = undefined;
            }
            const paciente = idxPaciente >= 0 ? col[idxPaciente]?.trim() : '';
            if (atend) {
                dados.push({
                    atend: SecurityUtils.sanitizeText(atend),
                    sessoes,
                    paciente: SecurityUtils.sanitizeText(paciente)
                });
            }
        }
        return dados;
    }

    mostrarPreview(validacao, dados) {
        if (!this.ui) return;

        let html = `<div style="padding:10px;background:#16202a;border-radius:4px;margin-bottom:10px;">`;
        html += `<div style="font-weight:600;margin-bottom:8px;">📋 PREVIEW</div>`;
        html += `<div style="font-size:12px;margin-bottom:6px;">Total: <b>${validacao.total}</b> registros</div>`;
        html += `<div style="font-size:12px;margin-bottom:6px;">✅ Válidos: <b>${validacao.validos}</b></div>`;
        if (validacao.invalidos > 0)
            html += `<div style="font-size:12px;margin-bottom:6px;color:#e74c3c;">❌ Inválidos: <b>${validacao.invalidos}</b></div>`;
        if (validacao.duplicados > 0)
            html += `<div style="font-size:12px;margin-bottom:6px;color:#f39c12;">⚠️ Duplicados: <b>${validacao.duplicados}</b></div>`;

        if (validacao.avisos.length > 0) {
            html += `<div style="margin-top:10px;padding:8px;background:#34495e;border-radius:4px;max-height:150px;overflow-y:auto;font-size:11px;">`;
            validacao.avisos.forEach(
                (aviso) =>
                    (html += `<div style="margin-bottom:4px;">${SecurityUtils.sanitizeHTML(aviso)}</div>`)
            );
            html += `</div>`;
        }
        html += `</div>`;

        html += `<div style="margin-bottom:10px;font-size:11px;">`;
        html += `<button id="btn-usar-limpos" style="padding:5px 10px;background:#2980b9;color:white;border:none;border-radius:3px;cursor:pointer;">Usar apenas válidos (${validacao.validos})</button>`;
        html += `</div>`;
        html += `<div style="display:flex;gap:10px;">`;
        html += `<button id="btn-continuar-exec" style="flex:1;padding:10px;background:#27ae60;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;">✅ Continuar</button>`;
        html += `<button id="btn-cancelar-exec" style="flex:1;padding:10px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;">❌ Cancelar</button>`;
        html += `</div>`;

        this.ui.mostrarPreview(html);

        let dadosSelecionados = dados;
        document.getElementById('btn-usar-limpos')?.addEventListener('click', () => {
            dadosSelecionados = validacao.dadosLimpos;
            this.log(`Dados limpos selecionados: ${dadosSelecionados.length} registros.`, 'info');
        });
        document.getElementById('btn-continuar-exec')?.addEventListener('click', () => {
            this.iniciarExecucao(dadosSelecionados);
        });
        document.getElementById('btn-cancelar-exec')?.addEventListener('click', () => {
            if (this.ui) this.ui.statusBox.textContent = 'Aguardando dados...';
        });
    }

    async iniciarExecucao(dados) {
        this.executando = true;
        this.pausado = false;
        this.primeiroAtendimento = true;
        this.relatorio = { sucesso: [], pendencia: [], pulado: [] };
        this.contadorPacientesDesdeReset = 0;
        SecurityUtils.rateLimiter.reset();
        this.domCache.clear();
        this.inicioProcessamento = Date.now();
        this.totalPacientes = dados.length;
        this.performanceData = { pacientes: [], inicioLote: Date.now(), temposEtapas: {} };

        this.ui.statusBox.textContent = '';
        this.log(`🚀 Iniciando processamento de ${dados.length} atendimentos`, 'info');
        this.ui.atualizarBotoes(this.executando, this.pausado);
        await this.processarLote(dados, 0);
    }

    async processarLote(dados, indiceInicial) {
        let errosConsecutivos = 0;
        let contadorPausaProgramada = 0;

        for (let i = indiceInicial; i < dados.length; i++) {
            if (!this.executando) {
                this.log('⏹️ Execução interrompida pelo usuário', 'info');
                break;
            }

            await this.aguardarSePausado();

            if (!SecurityUtils.rateLimiter.podeExecutar()) {
                this.log('⏸️ Limite de requisições atingido, aguardando...', 'warning');
                await new Promise((r) => setTimeout(r, 2000));
            }

            const item = dados[i];
            this.pacienteAtual = { nome: item.paciente, atend: item.atend };
            this.log(
                `[${i + 1}/${dados.length}] Processando ${item.paciente || item.atend}`,
                'info'
            );

            this.ui.atualizarProgresso(i + 1, dados.length);

            const inicioPaciente = performance.now();

            try {
                this.salvarEstado(dados, i);

                let contaAberta = false;
                if (this.primeiroAtendimento) {
                    this.log('🔎 Modo primeiro paciente...', 'info');
                    contaAberta = await primeiroFluxo(item.atend, this);
                    if (contaAberta) this.primeiroAtendimento = false;
                } else {
                    await this.fecharPopupsErro();
                    const trocou = await trocarAtendimentoPeloHeader(item.atend, this);
                    if (trocou) {
                        const pronto = await this.aguardarContaPronta(15000);
                        if (!pronto) {
                            this.log(
                                '⚠️ Conta não ficou pronta a tempo — pulando paciente',
                                'erro'
                            );
                            this.relatorio.pendencia.push({
                                paciente: item.paciente || '',
                                atend: item.atend || '',
                                texto: `${item.paciente} | ${item.atend} — tela não pronta`,
                                detalhe: 'Conta não ficou pronta a tempo',
                                timestamp: new Date()
                            });
                            errosConsecutivos++;
                            continue;
                        }

                        if (!this.executando) break;

                        this.dataAltaAtual = this.obterDataAltaCabecalho();
                        if (this.dataAltaAtual) {
                            this.log(
                                `⚠️ Paciente com alta/falecimento. Data será usada: ${this.dataAltaAtual.toLocaleDateString('pt-BR')}`,
                                'warning'
                            );
                        }

                        contaAberta = await localizarEAbrirBPA(this);
                    }
                }

                if (!this.executando) break;
                await this.aguardarSePausado();

                const momento = new Date();

                if (contaAberta) {
                    for (let t = 0; t < 4; t++) {
                        if (!this.executando) break;
                        await this.aguardarSePausado();
                        await this.esperar(Math.round(this.config.tempo / 4));
                    }
                    if (!this.executando) break;
                    const ok = await executarAgente4(item.sessoes, this);
                    if (ok) {
                        this.relatorio.sucesso.push({
                            paciente: item.paciente || '',
                            atend: item.atend || '',
                            texto: `${item.paciente} | ${item.atend}`,
                            timestamp: momento
                        });
                        this.log(`✅ ${item.paciente || item.atend} - Concluído`, 'sucesso');
                        errosConsecutivos = 0;

                        const tempoPaciente = performance.now() - inicioPaciente;
                        this._registrarPerformance(item, tempoPaciente);
                    } else {
                        this.relatorio.pendencia.push({
                            paciente: item.paciente || '',
                            atend: item.atend || '',
                            texto: `${item.paciente} | ${item.atend}`,
                            detalhe: 'Procedimentos não confirmados',
                            timestamp: momento
                        });
                        this.log(`⚠️ Pendência: ${item.paciente || item.atend}`, 'erro');
                        errosConsecutivos++;
                    }
                } else {
                    this.relatorio.pulado.push({
                        paciente: item.paciente || '',
                        atend: item.atend || '',
                        texto: `${item.paciente} | ${item.atend} — BPA não encontrado`,
                        detalhe: 'BPA não encontrado',
                        timestamp: momento
                    });
                    this.log(
                        `⏭️ Pulado: ${item.paciente || item.atend} (BPA não encontrado)`,
                        'erro'
                    );
                    errosConsecutivos++;
                }

                await this.verificarCircuitBreaker(errosConsecutivos);

                this.contadorPacientesDesdeReset++;
                contadorPausaProgramada++;

                if (this.contadorPacientesDesdeReset >= CONSTANTES.PACIENTES_POR_RESET) {
                    this.log('🔄 Resetando interface...', 'info');
                    this.domCache.clear();
                    await new Promise((r) => setTimeout(r, CONSTANTES.TEMPOS.RESET_INTERFACE));
                    this.contadorPacientesDesdeReset = 0;
                }

                await this.verificarPausaProgramada(contadorPausaProgramada);
                contadorPausaProgramada = 0;

                this.domCache.clear();
            } catch (erro) {
                this.errorHandler.log(erro, `processarAtendimento: ${item.atend}`);
                this.log(`❌ Erro ao processar ${item.atend}: ${erro.message}`, 'erro');
                this.relatorio.pendencia.push({
                    paciente: item.paciente || '',
                    atend: item.atend || '',
                    texto: `${item.paciente} | ${item.atend} - Erro`,
                    detalhe: erro.message,
                    timestamp: new Date()
                });
                errosConsecutivos++;
                await this.verificarCircuitBreaker(errosConsecutivos);
            }
        }

        this.ui.esconderProgresso();
        if (this.executando) await this.finalizarExecucao(dados.length);
    }

    async finalizarExecucao(total) {
        this.executando = false;
        this.pausado = false;
        this.ui.atualizarBotoes(false, false);
        this.log('═'.repeat(40), 'info');
        this.log('📊 RELATÓRIO FINAL', 'info');
        this.log(
            `Total: ${total} | ✅ ${this.relatorio.sucesso.length} | ⚠️ ${this.relatorio.pendencia.length} | ⏭️ ${this.relatorio.pulado.length}`,
            'info'
        );

        salvarEstatisticas(this.storage, this.relatorio, total, this.errorHandler);
        this.limparEstado();

        if (this.config.autoExport)
            setTimeout(
                () =>
                    exportarRelatorioCSV(
                        this.relatorio,
                        this.baixarArquivo.bind(this),
                        this.getTimestamp.bind(this)
                    ),
                500
            );
        tocarBeep(this.config, this.errorHandler);
        notificar(this.config, total, this.relatorio.sucesso.length, this.errorHandler);
        this.ui.mostrarBotoesExport();
        setTimeout(() => {
            const statusBox = document.getElementById('status-box');
            if (!statusBox) return;
            if (document.getElementById('btn-export-perf')) return;
            const btnPerfExport = document.createElement('button');
            btnPerfExport.id = 'btn-export-perf';
            btnPerfExport.textContent = '📈 Exportar Performance';
            Object.assign(btnPerfExport.style, {
                flex: '1',
                padding: '10px',
                background: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px'
            });
            btnPerfExport.addEventListener('click', () => this._exportarPerformanceCSV());
            statusBox.appendChild(btnPerfExport);
        }, 200);

        this._adicionarBotaoPDF();
    }

    _adicionarBotaoPDF() {
        setTimeout(() => {
            const statusBox = document.getElementById('status-box');
            if (!statusBox) return;
            if (document.getElementById('btn-export-pdf')) return;
            const btnPDF = document.createElement('button');
            btnPDF.id = 'btn-export-pdf';
            btnPDF.textContent = '📄 Exportar PDF';
            Object.assign(btnPDF.style, {
                flex: '1',
                padding: '10px',
                background: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px'
            });
            btnPDF.addEventListener('click', () => exportarRelatorioPDF(this.relatorio));
            statusBox.appendChild(btnPDF);
        }, 100);
    }

    baixarArquivo(conteudo, nomeArquivo, tipo) {
        const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        URL.revokeObjectURL(url);
    }

    _exportarPerformanceCSV() {
        if (!this.performanceData || this.performanceData.pacientes.length === 0) {
            alert('Nenhum dado de performance disponível.');
            return;
        }
        const linhas = [['Paciente', 'Atendimento', 'Tempo Total (s)']];
        this.performanceData.pacientes.forEach((p) => {
            linhas.push([p.paciente, p.atend, p.tempoTotal]);
        });
        const csv = linhas.map((l) => l.join(';')).join('\n');
        this.baixarArquivo(csv, `performance_${this.getTimestamp()}.csv`, 'text/csv');
    }

    getTimestamp() {
        return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    }

    handlePause() {
        if (this.executando) this.pausar();
    }
    handleStop() {
        if (this.executando && confirm('Deseja realmente parar a execução?')) this.parar();
    }

    salvarConfigUI() {
        const novaConfig = {};

        CONFIG_SCHEMA.forEach((campo) => {
            switch (campo.type) {
                case 'numero': {
                    const bruto = parseInt(document.getElementById(campo.id)?.value, 10);
                    novaConfig[campo.key] = Number.isNaN(bruto) ? CONFIG_PADRAO[campo.key] : bruto;
                    break;
                }

                case 'procedimentos-editor':
                    novaConfig[campo.key] = Array.isArray(this.config.procedimentos)
                        ? this.config.procedimentos
                        : [];
                    break;

                case 'checkbox':
                    novaConfig[campo.key] = document.getElementById(campo.id)?.checked || false;
                    break;

                case 'checkbox-numero': {
                    novaConfig[campo.key] = document.getElementById(campo.id)?.checked || false;
                    const bruto = parseInt(document.getElementById(campo.numeroId)?.value, 10);
                    novaConfig[campo.numeroKey] = Number.isNaN(bruto)
                        ? CONFIG_PADRAO[campo.numeroKey]
                        : bruto;
                    break;
                }

                case 'checkbox-dois-numeros': {
                    novaConfig[campo.key] = document.getElementById(campo.id)?.checked || false;

                    const bruto1 = parseInt(document.getElementById(campo.num1Id)?.value, 10);
                    novaConfig[campo.num1Key] = Number.isNaN(bruto1)
                        ? CONFIG_PADRAO[campo.num1Key]
                        : bruto1;

                    const bruto2 = parseInt(document.getElementById(campo.num2Id)?.value, 10);
                    const base2 = Number.isNaN(bruto2)
                        ? CONFIG_PADRAO[campo.num2Key] / (campo.emSegundos ? 1000 : 1)
                        : bruto2;
                    novaConfig[campo.num2Key] = campo.emSegundos ? base2 * 1000 : base2;
                    break;
                }
            }
        });

        this.atualizarConfig(novaConfig);
        this.log('⚙️ Configurações salvas', 'sucesso');

        const modal = document.getElementById('modal-config');
        if (modal) modal.style.display = 'none';
        const painelConfig = document.getElementById('painel-config');
        if (painelConfig) {
            painelConfig.style.display = 'none';
            painelConfig.style.opacity = '0';
            painelConfig.style.maxHeight = '0';
            painelConfig.style.overflow = 'hidden';
            const painelCorpo = document.getElementById('painel-corpo');
            if (painelCorpo && !painelCorpo.contains(painelConfig)) {
                painelCorpo.appendChild(painelConfig);
            }
        }
    }

    async retomarEstado(estado) {
        if (this.ui) this.ui.esconderAvisoRecuperacao();
        this.relatorio.sucesso = estado.relatorio?.sucesso || [];
        this.relatorio.pendencia = estado.relatorio?.pendencia || [];
        this.relatorio.pulado = estado.relatorio?.pulado || [];

        const temCabecalho = !!document.querySelector('div.person-bar-field-info');
        this.primeiroAtendimento = !temCabecalho;

        this.log('▶️ Retomando execução anterior...', 'info');
        this.executando = true;
        this.pausado = false;
        this.ui.atualizarBotoes(this.executando, this.pausado);
        this.totalPacientes = estado.dados.length;
        this.inicioProcessamento = Date.now();
        await this.processarLote(estado.dados, estado.indice);
    }

    destroy() {
        if (this.ui) this.ui.destroy();
        if (this.logUI) this.logUI.destroy();
        window.__AGENTE_TASY_V40_LOADED__ = false;
    }
}
