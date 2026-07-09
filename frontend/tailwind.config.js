/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#09b8a0',
          50: '#e6f9f6',
          100: '#bfeeda',
          200: '#8fe4c0',
          300: '#5fd9a4',
          400: '#2ed08d',
          500: '#09b8a0',
          600: '#08a38e',
          700: '#078d7a',
          800: '#067766',
          900: '#045044',
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
