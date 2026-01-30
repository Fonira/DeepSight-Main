/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        deepsight: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          dark: '#1e1b4b',
          light: '#e0e7ff',
        },
      },
    },
  },
  plugins: [],
};
