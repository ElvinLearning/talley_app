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
        // Secondary text. Darkened from #808080 so it passes WCAG AA (4.5:1)
        // on white, paper and sand backgrounds.
        steel: {
          DEFAULT: '#655F5D',
          light: '#A8A5A3',
        },
        ink: '#241B1C',
        sand: '#F6F2EC',
        paper: '#FCFAF7',
        line: '#E4DCD2',
        danger: { DEFAULT: '#A32A1B', tint: '#FBEDEA' },
        ok: { DEFAULT: '#1F6B49', tint: '#E6F2EB' },
        warn: { DEFAULT: '#8A5200', tint: '#FBF1DC' },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 27, 28, 0.05)',
        lift: '0 12px 32px rgba(36, 27, 28, 0.16)',
      },
    },
  },
  plugins: [],
}
