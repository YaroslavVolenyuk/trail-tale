/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // ── Mobile dark surfaces ──
        bg: { DEFAULT: '#0A0A0A', chrome: '#1A1A1A' },
        surface: { DEFAULT: '#1C1C1E', raised: '#232323', hint: '#2A2200' },
        border: { DEFAULT: '#2C2C2E', input: '#3A3A3C' },
        text: {
          DEFAULT: '#FFFFFF',
          muted: '#8E8E93',
          body: '#C7C7CC',
          hint: '#E8D5A3',
        },
        accent: { DEFAULT: '#F5A623', soft: '#FFF8EC' },
        danger: '#FF453A',
        success: '#32D74B',
        // ── Admin light surfaces ──
        adm: {
          bg: '#FFFFFF',
          sidebar: '#F5F5F7',
          border: '#E5E5E7',
          text: '#1C1C1E',
          muted: '#6E6E73',
          placeholder: '#9E9E9E',
          stuck: '#FFF5F5',
          publishedBg: '#DCFCE7',
          publishedFg: '#166534',
          draftBg: '#FEF9C3',
          draftFg: '#854D0E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        input: '12px',
        card: '16px',
        btn: '14px',
      },
      height: {
        btn: '52px',
        input: '52px',
        ctrl: '48px',
      },
      keyframes: {
        livepulse: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        livepulse: 'livepulse 1.5s ease-in-out infinite',
        shake: 'shake 0.35s ease-in-out',
      },
      spacing: {
        'safe-b': 'max(env(safe-area-inset-bottom), 28px)',
      },
    },
  },
  plugins: [],
};
