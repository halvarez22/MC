/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind 3.4.0: usar 'class' (no 'selector' — puede no generar dark: en esta versión)
  darkMode: 'class',
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ff5f00',
          light: '#ff8533',
          lightest: '#ffe0cc',
          dark: '#cc4a00',
        },
        secondary: '#4B5563',
        light: '#ffffff',
        dark: '#1F2937',
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
