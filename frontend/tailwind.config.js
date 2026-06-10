/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maple: {
          50: '#fff8f1',
          100: '#feeedc',
          200: '#fdd5b3',
          300: '#fbb37f',
          400: '#f88843',
          500: '#f56213', // 메이플 시그니처 주황색
          600: '#e64906',
          700: '#bf3407',
          800: '#97290c',
          900: '#7a240e',
          950: '#420f03',
        },
        darkbg: {
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
        }
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-highlight': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
      }
    },
  },
  plugins: [],
}
