/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#ccfbf0',
          200: '#99f6e3',
          300: '#5eead2',
          400: '#2dd4bd',
          500: '#14b8a2',
          600: '#008775', // CloudThinker primary teal
          700: '#007363',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        evidence: {
          verified: '#2F6F5E',
          inferred: '#B08628',
          assumed: '#7A5FA0',
          blocked: '#B4402D',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
        mono: ['IBM Plex Sans', 'JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
