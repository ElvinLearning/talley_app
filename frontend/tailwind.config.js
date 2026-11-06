/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#6D2431',
          dark: '#4B1620',
          light: '#8A3444',
          tint: '#F5EAEC',
        },
        steel: {
          DEFAULT: '#808080',
          light: '#A8A5A3',
        },
        ink: '#241B1C',
        sand: '#F6F2EC',
        paper: '#FCFAF7',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 27, 28, 0.06)',
        lift: '0 12px 32px rgba(36, 27, 28, 0.16)',
      },
    },
  },
  plugins: [],
}
