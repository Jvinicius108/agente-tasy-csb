// popup.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.getElementById('version');
    const manifestVersion = chrome.runtime.getManifest().version;
    versionEl.textContent = `v${manifestVersion}`;

    const statusEl = document.getElementById('status');
    const infoEl = document.getElementById('info');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || '';
        const isTasy = url.includes('tasy.grupocsb.com');

        if (isTasy) {
            statusEl.textContent = '✅ Agente ativo nesta aba';
            statusEl.classList.add('ativo');
            infoEl.textContent = 'O painel está visível na página do Tasy.';
        } else {
            statusEl.textContent = '⚠️ Abra o Tasy para usar';
            statusEl.classList.add('inativo');
            infoEl.textContent = 'O agente só funciona dentro do sistema Tasy.';
        }
    });
});
