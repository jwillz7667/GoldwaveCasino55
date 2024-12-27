module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:react/recommended', 'prettier'],
    parser: '@babel/eslint-parser',
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        requireConfigFile: false,
        jsx: true,
    },
    plugins: ['react'],
    rules: {
        'no-undef': 'off',
        'no-console': 'warn',
        // Add or adjust more frontend-specific rules as needed
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
};
