const http = require("http");

//const FRONTEND_HOST = "10.16.1.137";
const FRONTEND_HOST = "Rawim";
const FRONTEND_PORT = 5173;

//const BACKEND_HOST = "10.16.7.152";
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 5000;

const proxy = http.createServer((req, res) => {
  const isApi = req.url === "/api" || req.url.startsWith("/api/");

  const targetHost = isApi ? BACKEND_HOST : FRONTEND_HOST;
  const targetPort = isApi ? BACKEND_PORT : FRONTEND_PORT;

  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${targetHost}:${targetPort}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    console.error("Proxy error:", error.message);

    if (!res.headersSent) {
      res.writeHead(502, {
        "Content-Type": "application/json",
      });
    }

    res.end(
      JSON.stringify({
        success: false,
        message: "Proxy target unavailable",
      }),
    );
  });

  req.pipe(proxyReq);
});

proxy.listen(8080, "127.0.0.1", () => {
  console.log("Penma reverse proxy running on http://127.0.0.1:8080");
});