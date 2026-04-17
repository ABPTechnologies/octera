import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Octera brand tokens — derived from the logo's cyan/teal/blue ribbons
        // on a deep navy background.
        octera: {
          bg: '#0A0F1A',        // deep navy (primary background)
          surface: '#111827',   // card surfaces
          border: '#1F2937',    // subtle divider
          teal: '#2DD4BF',      // mid-ribbon green-teal
          cyan: '#22D3EE',      // top-ribbon bright cyan
          blue: '#3B82F6',      // bottom-ribbon deeper blue
          accent: '#00D4FF',    // highlight / CTA glow
          muted: '#94A3B8',     // secondary text
          text: '#E5E7EB',      // primary text on dark
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgb(34 211 238 / 0.35)',
      },
      backgroundImage: {
        'octera-gradient':
          'linear-gradient(135deg, #22D3EE 0%, #2DD4BF 50%, #3B82F6 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
