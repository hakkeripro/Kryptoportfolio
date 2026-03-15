/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          light: 'var(--color-brand-light)',
          dark: 'var(--color-brand-dark)',
        },
        surface: {
          base: 'var(--color-surface-base)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },
        content: {
          primary: 'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          tertiary: 'var(--color-content-tertiary)',
          inverse: 'var(--color-content-inverse)',
        },
        semantic: {
          success: 'var(--color-semantic-success)',
          warning: 'var(--color-semantic-warning)',
          error: 'var(--color-semantic-error)',
          info: 'var(--color-semantic-info)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'heading-1': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'heading-2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'heading-3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-4': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '500' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.75rem',
        button: '0.5rem',
        input: '0.5rem',
        badge: '9999px',
      },
      spacing: {
        page: '1.5rem',
        section: '1.5rem',
        card: '1rem',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        'glow-brand': 'var(--glow-brand)',
        'glow-brand-strong': 'var(--glow-brand-strong)',
        'glow-success': 'var(--glow-success)',
        'glow-error': 'var(--glow-error)',
        'glow-warning': 'var(--glow-warning)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s var(--ease-out-expo) both',
        'slide-up': 'slide-up 0.3s var(--ease-out-expo) both',
        'scale-in': 'scale-in 0.2s var(--ease-spring) both',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease-in-out infinite',
      },
      transitionTimingFunction: {
        expo: 'var(--ease-out-expo)',
        spring: 'var(--ease-spring)',
      },
      backgroundImage: {
        'gradient-card': 'var(--gradient-card-bg)',
        'gradient-brand-subtle': 'var(--gradient-brand-subtle)',
      },
    },
  },
  plugins: [],
};
