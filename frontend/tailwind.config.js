/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#003153',
          50: '#e8eef5',
          100: '#c9d6e4',
          200: '#93aac4',
          300: '#5d80a3',
          400: '#2f5a85',
          500: '#0e4271',
          600: '#002640',
          700: '#00203a',
          800: '#001a30',
          900: '#001224',
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
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
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
