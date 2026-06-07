/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F0EB',
        navy: {
          DEFAULT: '#1C2B3A',
          light: '#2D4155',
          dark: '#0F1E2C',
        },
        brand: {
          DEFAULT: '#F4732A',
          dark: '#D95F18',
        },
        ink: '#0A0A0A',
      },
    },
  },
  plugins: [],
};
