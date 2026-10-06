// watch.js
'use strict';

const fs = require('fs');
const { spawn } = require('child_process');

const RAIZ = __dirname;
const IGNORADOS = new Set(['agente-bundle.js', 'package-lock.json']);

let building = false;
let agendado = null;

function executarBuild() {
    if (building) {
        agendado = true;
        return;
    }
    building = true;

    const inicio = Date.now();
    const proc = spawn('node', ['build.js'], { stdio: 'inherit', cwd: RAIZ });

    proc.on('close', (code) => {
        building = false;
        const tempo = Date.now() - inicio;

        if (code === 0) {
            console.log(`\n⏱️  Build em ${tempo}ms. Recarregue a extensão no Chrome.\n`);
        } else {
            console.error(`\n❌ Build falhou (código ${code}).\n`);
        }

        if (agendado) {
            agendado = false;
            executarBuild();
        }
    });
}

console.log('👀 Observando alterações em *.js na raiz...');
console.log('Pressione Ctrl+C para parar.\n');

executarBuild();

fs.watch(RAIZ, (eventType, filename) => {
    if (!filename) return;
    if (IGNORADOS.has(filename)) return;
    if (!filename.endsWith('.js')) return;
    if (filename.startsWith('.')) return;

    console.log(`🔄 Alteração detectada: ${filename}`);
    executarBuild();
});
