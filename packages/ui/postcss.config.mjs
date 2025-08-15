/** @type {import('postcss-load-config').Config} */
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config.ts';

const config = {
  plugins: [
    tailwindcss(tailwindConfig),
    autoprefixer,
  ],
};

export default config;