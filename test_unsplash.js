const http = require("http");
const { URL } = require("url");
const PROXY = { host: "127.0.0.1", port: 7897 };

function proxyGet(targetUrl) {
  return new Promise((resolve) => {
    const urlObj = new URL(targetUrl);
    const req = http.request({ host: PROXY.host, port: PROXY.port, method: "CONNECT", path: urlObj.host + ":443" });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) { resolve("proxy fail"); return; }
      const tls = require("tls");
      const tlsSocket = tls.connect({ socket, servername: urlObj.host }, () => {
        tlsSocket.write("GET " + urlObj.pathname + urlObj.search + " HTTP/1.1\r\nHost: " + urlObj.host + "\r\nConnection: close\r\n\r\n");
      });
      let data = "";
      tlsSocket.on("data", (c) => data += c.toString());
      tlsSocket.on("end", () => resolve(data.split("\r\n\r\n").slice(1).join("\r\n\r\n")));
    });
    req.on("error", (e) => resolve("error: " + e.message));
    req.setTimeout(15000, () => { req.destroy(); resolve("timeout"); });
    req.end();
  });
}

// Test if Unsplash source URLs work (these are direct image links)
(async () => {
  const testUrls = [
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=500&fit=crop",
  ];
  for (const url of testUrls) {
    try {
      const urlObj = new URL(url);
      const req = http.request({ host: PROXY.host, port: PROXY.port, method: "CONNECT", path: urlObj.host + ":443" });
      const result = await new Promise((resolve) => {
        req.on("connect", (res, socket) => {
          const tls = require("tls");
          const tlsSocket = tls.connect({ socket, servername: urlObj.host }, () => {
            tlsSocket.write("HEAD " + urlObj.pathname + urlObj.search + " HTTP/1.1\r\nHost: " + urlObj.host + "\r\nConnection: close\r\n\r\n");
          });
          let data = "";
          tlsSocket.on("data", (c) => data += c.toString());
          tlsSocket.on("end", () => resolve(data.substring(0, 500)));
        });
        req.on("error", (e) => resolve("error: " + e.message));
        req.setTimeout(10000, () => { req.destroy(); resolve("timeout"); });
        req.end();
      });
      console.log("Unsplash test: " + result);
    } catch(e) {
      console.log("Error: " + e.message);
    }
  }
})();
