// storageManager.js
'use strict';

class StorageManager {
    constructor(errorHandler) {
        this.errorHandler = errorHandler;
        this.verificarVersaoDados();
    }

    verificarVersaoDados() {
        try {
            const versaoSalva = localStorage.getItem(CONSTANTES.KEYS.VERSAO_DADOS);
            const versaoAtual = parseInt(versaoSalva, 10) || 0;

            if (versaoAtual < CONSTANTES.VERSAO_DADOS_ATUAL) {
                this.migrarDados(versaoAtual);
                localStorage.setItem(
                    CONSTANTES.KEYS.VERSAO_DADOS,
                    String(CONSTANTES.VERSAO_DADOS_ATUAL)
                );
            }
        } catch (e) {
            this.errorHandler.log(e, 'verificarVersaoDados');
        }
    }

    migrarDados(versaoAntiga) {
        const passos = [];

        if (versaoAntiga <= 0) {
            passos.push('v0 → v1 (inicialização de schema versionado)');
        }

        if (versaoAntiga <= 1) {
            passos.push('v1 → v2 (adição de versionamento + limpeza de stats antigas)');
        }

        if (passos.length === 0) {
            return;
        }

        console.log(
            `%c[StorageManager] Migrando dados v${versaoAntiga} → v${CONSTANTES.VERSAO_DADOS_ATUAL}`,
            'color: #f39c12; font-weight: bold;'
        );
        passos.forEach((p) => console.log(`  • ${p}`));
    }

    salvar(chave, dados) {
        try {
            const serializado = JSON.stringify(dados);
            if (serializado.length > 5000000) {
                throw new Error('Dados muito grandes para salvar');
            }
            localStorage.setItem(chave, serializado);
            return true;
        } catch (e) {
            this.errorHandler.log(e, `salvar: ${chave}`);
            if (e.name === 'QuotaExceededError') {
                this.limparDadosAntigos();
                try {
                    localStorage.setItem(chave, JSON.stringify(dados));
                    return true;
                } catch (e2) {
                    this.errorHandler.log(e2, `salvar (segunda tentativa): ${chave}`);
                }
            }
            return false;
        }
    }

    carregar(chave, padrao = null) {
        try {
            const item = localStorage.getItem(chave);
            return item ? JSON.parse(item) : padrao;
        } catch (e) {
            this.errorHandler.log(e, `carregar: ${chave}`);
            return padrao;
        }
    }

    remover(chave) {
        try {
            localStorage.removeItem(chave);
            return true;
        } catch (e) {
            this.errorHandler.log(e, `remover: ${chave}`);
            return false;
        }
    }

    limparDadosAntigos() {
        try {
            const stats = this.carregar(CONSTANTES.KEYS.STATS, {});
            const dias30Atras = new Date();
            dias30Atras.setDate(dias30Atras.getDate() - 30);

            const statsFiltradas = Object.keys(stats)
                .filter((data) => new Date(data) >= dias30Atras)
                .reduce((obj, key) => {
                    obj[key] = stats[key];
                    return obj;
                }, {});

            this.salvar(CONSTANTES.KEYS.STATS, statsFiltradas);
        } catch (e) {
            this.errorHandler.log(e, 'limparDadosAntigos');
        }
    }
}
