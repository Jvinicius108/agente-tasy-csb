// eslint.config.js
'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['agente-bundle.js', 'jspdf.umd.min.js', 'node_modules/**', 'dist/**', '*.zip']
    },

    js.configs.recommended,

    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                CONSTANTES: 'readonly',
                SecurityUtils: 'readonly',
                AgenteTASY: 'readonly',
                CONFIG_PADRAO: 'readonly',
                CONFIG_SCHEMA: 'readonly',
                PROCEDIMENTOS: 'readonly',
                Debouncer: 'readonly',
                DOMCache: 'readonly',
                ErrorHandler: 'readonly',
                StorageManager: 'readonly',
                LogUI: 'readonly',
                UIPainel: 'readonly',
                angular: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['error', { checkLoops: false }],
            'no-irregular-whitespace': 'warn',
            'no-redeclare': 'error',
            'no-unreachable': 'warn',
            'no-var': 'warn',
            eqeqeq: ['warn', 'smart'],
            'no-console': 'off'
        }
    },

    {
        files: ['build.js', 'watch.js', 'package.js', 'eslint.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },

    {
        files: ['scripts/**/*.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },

    {
        files: ['popup.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                chrome: 'readonly'
            }
        }
    }
];
