module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'document': 'off',
    'no-useless-escape': 'off',
    'no-unused-vars': 'warn',
    'semi': ['error', 'always'],
    'no-undef': 'warn'
  }
};
