/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#4361ee',
        primaryDark: '#3a56d4',
        secondary: '#7209b7',
        success: '#06d6a0',
        danger: '#ef476f',
        warning: '#ffd166',
        dark: '#2b2d42',
        light: '#f8f9fa',
        gray: '#8d99ae',
        background: '#f0f2f5',
      }
    },
  },
  plugins: [],
};
