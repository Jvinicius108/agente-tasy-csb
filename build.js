// build.js
'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const arquivos = [
    'constants.js',
    'securityUtils.js',
    'errorHandler.js',
    'domCache.js',
    'storageManager.js',
    'debouncer.js',
    'config.js',
    'configSchema.js',
    'procedures.js',
    'notificacoes.js',
    'relatorio.js',
    'relatorioPDF.js',
    'logUI.js',
    'fluxoNormal.js',
    'fluxoPopup.js',
    'navegacao.js',
    'executorAgente4.js',
    'uiPainel.js',
    'agenteCore.js',
    'main.js'
];

const MINIFICAR = process.env.NODE_ENV === 'production';

function stripImportsExports(conteudo) {
    let out = conteudo;

    out = out.replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?/gm, '');
    out = out.replace(/^import\s+['"][^'"]+['"]\s*;?/gm, '');

    out = out.replace(/^export\s+default\s+/gm, '');
    out = out.replace(/^export\s+\{[^}]*\}\s*(?:from\s+['"][^'"]+['"]\s*;?)?/gm, '');
    out = out.replace(/^export\s+(const|let|var|function|class|async)\s+/gm, '$1 ');

    return out;
}

async function build() {
    const inicio = Date.now();
    let bundle = '(function() {\n"use strict";\n\n';
    let totalModulos = 0;

    for (const arquivo of arquivos) {
        const caminho = path.join(__dirname, arquivo);
        if (!fs.existsSync(caminho)) {
            console.warn(`⚠️  Arquivo não encontrado: ${caminho}`);
            continue;
        }

        let conteudo = fs.readFileSync(caminho, 'utf8');
        conteudo = stripImportsExports(conteudo);

        bundle += `\n// ===== ${arquivo} =====\n`;
        bundle += conteudo + '\n';
        totalModulos++;
    }

    bundle += '\n})();';

    const tamanhoAntes = Buffer.byteLength(bundle, 'utf8');

    if (MINIFICAR) {
        const resultado = await esbuild.transform(bundle, {
            minify: true,
            target: ['chrome100'],
            legalComments: 'none'
        });
        bundle = resultado.code;
    }

    fs.writeFileSync('agente-bundle.js', bundle, 'utf8');

    const tamanhoFinal = Buffer.byteLength(bundle, 'utf8');
    const kb = (tamanhoFinal / 1024).toFixed(1);
    const tempo = Date.now() - inicio;
    const modo = MINIFICAR ? 'minificado' : 'normal';

    console.log(`✅ Bundle gerado (${modo}): agente-bundle.js`);
    console.log(`   📦 ${totalModulos} módulos concatenados`);
    console.log(
        `   📏 ${kb} KB${MINIFICAR ? ` (antes: ${(tamanhoAntes / 1024).toFixed(1)} KB)` : ''}`
    );
    console.log(`   ⏱️  ${tempo}ms`);
}

build().catch((err) => {
    console.error('❌ Erro no build:', err);
    process.exit(1);
});
