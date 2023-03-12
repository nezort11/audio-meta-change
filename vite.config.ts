import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
