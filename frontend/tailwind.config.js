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
        navy: {
          DEFAULT: '#0b1d33',
          50: '#e8edf3',
          100: '#c5d0e0',
          200: '#9fb1cb',
          300: '#7892b5',
          400: '#5a7aa4',
          500: '#3c6293',
          600: '#35588a',
          700: '#2c4c7e',
          800: '#234072',
          900: '#142c5e',
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
