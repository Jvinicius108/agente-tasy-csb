// scripts/check-version.js
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function lerJSON(arquivo) {
    const caminho = path.join(root, arquivo);
    if (!fs.existsSync(caminho)) {
        console.error(`❌ Arquivo não encontrado: ${arquivo}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(caminho, 'utf8'));
}

const manifest = lerJSON('manifest.json');
const pkg = lerJSON('package.json');

const constantsSrc = fs.readFileSync(path.join(root, 'constants.js'), 'utf8');
const match = constantsSrc.match(/VERSAO:\s*'V([\d.]+)'/);
const constantsVersion = match ? match[1] : null;

const manifestVersion = manifest.version;
const pkgVersionCompleta = pkg.version;
const pkgVersion = pkgVersionCompleta.split('.').slice(0, 2).join('.');

const issues = [];

if (pkgVersion !== manifestVersion) {
    issues.push(
        `package.json = "${pkgVersionCompleta}" (esperado "${manifestVersion}.x") ` +
            `≠ manifest.json = "${manifestVersion}"`
    );
}

if (constantsVersion === null) {
    issues.push(`constants.js: não foi possível extrair VERSAO (esperado formato VERSAO: 'V40.3')`);
} else if (constantsVersion !== manifestVersion) {
    issues.push(`constants.js = "V${constantsVersion}" ≠ manifest.json = "${manifestVersion}"`);
}

if (issues.length > 0) {
    console.error('❌ Versões divergentes:\n');
    issues.forEach((i) => console.error('  •', i));
    console.error('\nSincronize manualmente antes de commitar.');
    process.exit(1);
}

console.log(`✅ Versão unificada em todos os lugares: ${manifestVersion}`);
