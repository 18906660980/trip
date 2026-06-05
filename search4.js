const http = require("http");
const { URL } = require("url");
const PROXY = { host: "127.0.0.1", port: 7897 };
const UA = "TripSiteBot/1.0 (contact@example.com)";

function proxyGet(targetUrl) {
  return new Promise((resolve) => {
    const urlObj = new URL(targetUrl);
    const req = http.request({ host: PROXY.host, port: PROXY.port, method: "CONNECT", path: urlObj.host + ":443" });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) { resolve("proxy fail: " + res.statusCode); return; }
      const tls = require("tls");
      const tlsSocket = tls.connect({ socket, servername: urlObj.host }, () => {
        tlsSocket.write("GET " + urlObj.pathname + urlObj.search + " HTTP/1.1\r\nHost: " + urlObj.host + "\r\nUser-Agent: " + UA + "\r\nConnection: close\r\n\r\n");
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

async function searchFiles(searchTerm) {
  try {
    const r = await proxyGet("https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(searchTerm) + "&srnamespace=6&srlimit=3&format=json");
    const json = JSON.parse(r);
    if (!json.query || !json.query.search) return [];
    const titles = json.query.search.map(s => s.title).join("|");
    const r2 = await proxyGet("https://commons.wikimedia.org/w/api.php?action=query&titles=" + encodeURIComponent(titles) + "&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json");
    const json2 = JSON.parse(r2);
    const pages = json2.query ? Object.values(json2.query.pages) : [];
    return pages.filter(p => p.imageinfo && p.imageinfo[0].mime && p.imageinfo[0].mime.startsWith("image/")).map(p => ({ url: p.imageinfo[0].thumburl, size: p.imageinfo[0].size }));
  } catch(e) { return []; }
}

const searches = [
  { name: "wuhou", q: "Wuhou Shrine Chengdu temple" },
  { name: "hotpot", q: "Sichuan hotpot mala spicy" },
  { name: "chuanchuan", q: "skewer hotpot Chinese street food" },
  { name: "chaoshou", q: "Sichuan wonton" },
  { name: "rabbit_head", q: "spicy rabbit" },
  { name: "tianshui", q: "Chinese spicy noodles" },
];

(async () => {
  for (const s of searches) {
    const urls = await searchFiles(s.q);
    console.log(s.name + ": " + JSON.stringify(urls.slice(0,2)));
    await new Promise(r => setTimeout(r, 300));
  }
})();
