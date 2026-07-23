/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // "important" scopes Tailwind's reset so it doesn't fight your existing
  // CSS Module styles — like setting a higher specificity boundary so old
  // and new styles don't collide.
  corePlugins: {
    preflight: false, // disable Tailwind's CSS reset — keeps your existing global styles intact
  },
  theme: {
    extend: {
      colors: {
        // Mirrors your existing CSS variables so Lovable-generated Tailwind
        // classes can reference the SAME brand colors if needed
        ink: '#0A0F1E',
        gold: '#F59E0B',
        blue: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
