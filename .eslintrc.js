module.exports = {
    env: {
        es2021: true,
    },
    extends: ['eslint:recommended', 'prettier'],
    parser: '@babel/eslint-parser',
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        requireConfigFile: false,
    },
    rules: {
        'no-console': 'warn',
        // Global rules applicable to all files
    },
    overrides: [
        {
            files: ['server/**/*.js'],
            env: {
                node: true,
                jest: true,
            },
            extends: ['plugin:node/recommended'],
            plugins: ['jest'],
            rules: {
                'node/exports-style': ['error', 'module.exports'],
                'node/file-extension-in-import': ['error', 'always'],
                'node/prefer-global/buffer': ['error', 'always'],
                'node/prefer-global/console': ['error', 'always'],
                'node/prefer-global/process': ['error', 'always'],
                'node/no-process-exit': 'error',
                'node/prefer-promises/dns': 'error',
                'node/prefer-promises/fs': 'error',
                // Add more backend-specific rules here
            },
        },
        {
            files: ['src/**/*.js', 'src/**/*.jsx'],
            env: {
                browser: true,
            },
            extends: ['plugin:react/recommended'],
            plugins: ['react'],
            rules: {
                'no-undef': 'off',
                // Add or adjust frontend-specific rules here
            },
        },
    ],
};
