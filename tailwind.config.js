/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mc-orange': '#FF4D12',
        'mc-gray': '#58595B',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}