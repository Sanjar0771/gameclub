/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-bg, #ffffff)',
          'secondary-bg': 'var(--tg-secondary-bg, #f1f1f1)',
          text: 'var(--tg-text, #000000)',
          hint: 'var(--tg-hint, #999999)',
          link: 'var(--tg-link, #2481cc)',
          button: 'var(--tg-button, #3390ec)',
          'button-text': 'var(--tg-button-text, #ffffff)',
          'header-bg': 'var(--tg-header-bg, #ffffff)',
          'section-bg': 'var(--tg-section-bg, #ffffff)',
          'section-separator': 'var(--tg-section-separator, #e0e0e0)',
          accent: 'var(--tg-accent, #3390ec)',
          destructive: 'var(--tg-destructive, #ef4444)',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
