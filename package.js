// package.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = __dirname;

console.log('📦 Gerando pacote de distribuição...\n');

try {
    execSync('node build.js', { stdio: 'inherit', cwd: RAIZ });
    console.log('');
} catch {
    console.error('❌ Erro no build. Abortando.');
    process.exit(1);
}

const arquivos = [
    'manifest.json',
    'agente-bundle.js',
    'jspdf.umd.min.js',
    'popup.html',
    'popup.js',
    'options.html',
    'icon.png'
];

const tempDir = path.join(RAIZ, 'dist');
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
}
fs.mkdirSync(tempDir);

let faltando = 0;
arquivos.forEach((arq) => {
    const src = path.join(RAIZ, arq);
    const dest = path.join(tempDir, arq);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✔️  ${arq}`);
    } else {
        console.warn(`⚠️  Arquivo não encontrado: ${arq}`);
        faltando++;
    }
});

if (faltando > 0) {
    console.warn(`\n⚠️  ${faltando} arquivo(s) faltando. O ZIP pode estar incompleto.\n`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
const zipName = `AgenteTASY_v${manifest.version}.zip`;

try {
    if (process.platform === 'win32') {
        execSync(
            `powershell Compress-Archive -Path "${tempDir}\\*" -DestinationPath "${zipName}" -Force`,
            { stdio: 'inherit', cwd: RAIZ }
        );
    } else {
        execSync(`zip -r ${zipName} dist/*`, { stdio: 'inherit', cwd: RAIZ });
    }
    console.log(`\n✅ Pacote gerado: ${zipName}`);
} catch {
    console.log('\n⚠️  Não foi possível gerar ZIP automaticamente.');
    console.log('   Os arquivos estão em ./dist — compacte manualmente.');
}
