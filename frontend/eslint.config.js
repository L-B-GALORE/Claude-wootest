import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.vite/**',
      'coverage/**',
    ],
  },

  // Base configuration
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // ===== RECOMMENDED RULES =====
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // ===== CRASH PREVENTION RULES =====

      // Prevent undefined variables (catches missing imports!)
      'no-undef': 'error',

      // Prevent unused variables (helps identify import issues)
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Warn about console statements (except errors and warnings)
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],

      // ===== REACT-SPECIFIC RULES =====

      // Enforce prop-types or TypeScript for type safety
      'react/prop-types': 'off', // Turn off since we're not using prop-types

      // Prevent missing React in scope (auto-fixed in React 17+)
      'react/react-in-jsx-scope': 'off',

      // Require keys in lists
      'react/jsx-key': ['error', {
        checkFragmentShorthand: true,
        checkKeyMustBeforeSpread: true,
      }],

      // Prevent usage of dangerous properties
      'react/no-danger': 'warn',

      // Prevent invalid JSX
      'react/jsx-no-undef': 'error',

      // Prevent unused prop-types
      'react/no-unused-prop-types': 'warn',

      // Prevent direct mutation of this.state
      'react/no-direct-mutation-state': 'error',

      // ===== REACT HOOKS RULES =====

      // Checks rules of Hooks
      'react-hooks/rules-of-hooks': 'error',

      // Checks effect dependencies (CRITICAL for preventing stale closures)
      'react-hooks/exhaustive-deps': 'warn',

      // ===== CODE QUALITY RULES =====

      // Require === instead of ==
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // Prevent reassignment of function parameters
      'no-param-reassign': 'warn',

      // Require default case in switch statements
      'default-case': 'warn',

      // Prevent empty catch blocks
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Prevent unnecessary template literals
      'no-useless-concat': 'error',

      // Prevent use of variables before they are defined
      'no-use-before-define': ['error', {
        functions: false,
        classes: true,
        variables: true
      }],

      // ===== BEST PRACTICES =====

      // Enforce curly braces for all control statements
      'curly': ['error', 'all'],

      // Require return statements in array methods
      'array-callback-return': 'error',

      // Prevent eval()
      'no-eval': 'error',

      // Prevent implied eval()
      'no-implied-eval': 'error',

      // Prevent use of alert()
      'no-alert': 'warn',

      // ===== ASYNC/AWAIT & PROMISES =====

      // Require await in async functions
      'require-await': 'warn',

      // Prevent returning values from Promise executors
      'no-promise-executor-return': 'error',

      // Prevent async functions without await
      'no-async-promise-executor': 'error',

      // ===== NULL/UNDEFINED SAFETY =====

      // Prevent unnecessary ternary expressions
      'no-unneeded-ternary': 'warn',
    },
  },

  // Test files configuration (if added later)
  {
    files: ['**/*.test.{js,jsx}', '**/*.spec.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
