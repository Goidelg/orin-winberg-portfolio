import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  plugins: [
    {
      name: "rewrite-nested-assets",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /\/boring\/assets\//.test(req.url)) {
            req.url = req.url.replace(/\/boring\/assets\//, "/assets/");
          }
          next();
        });
      },
    },
  ],
});
