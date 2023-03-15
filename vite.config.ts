import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import legacy from "@vitejs/plugin-legacy";

// https://vitejs.dev/config/
export default defineConfig({
  // build: {
  //   target: "es6",
  // },
  plugins: [
    react(),
    legacy(),
    // basicSsl(),
    {
      name: "inject",
      transformIndexHtml() {
        return [
          {
            tag: "script",
            attrs: {
              // type: "module",
              src: "https://telegram.org/js/telegram-web-app.js",
              // defer: true,
            },
          },
          {
            tag: "style",
            attrs: {
              // style: {}
              style: "background: red;",
            },
          },
        ];
      },
    },
  ],
});
