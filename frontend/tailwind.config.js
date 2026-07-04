/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3cb0a3',
          50: '#e8f8f6',
          100: '#c5ede9',
          200: '#9fe2db',
          300: '#76d6cc',
          400: '#55cdbc',
          500: '#3cb0a3',
          600: '#34a093',
          700: '#2b8a7e',
          800: '#23756a',
          900: '#175249',
        },
      },
      animation: {
        'typing-bounce': 'typing-bounce 1.4s infinite ease-in-out',
      },
      keyframes: {
        'typing-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
