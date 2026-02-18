/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0e1117",
        sidebar: "#11141d",
        card: "#1a1c24",
        border: "#2d303e",
        primary: "#00d4ff",
        secondary: "#a0a0a0",
        text: "#fafafa",
      }
    },
  },
  plugins: [],
  // Cache buster: 1
}
