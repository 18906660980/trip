const http = require("http");
const { URL } = require("url");

const PROXY = { host: "127.0.0.1", port: 7897 };
const UA = "TripSiteBot/1.0 (contact@example.com)";

function proxyGet(targetUrl) {
  return new Promise((resolve) => {
    const urlObj = new URL(targetUrl);
    const req = http.request({
      host: PROXY.host, port: PROXY.port, method: "CONNECT",
      path: urlObj.host + ":443",
    });
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) { resolve("proxy fail"); return; }
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
    const r = await proxyGet(
      "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(searchTerm) + "&srnamespace=6&srlimit=2&format=json"
    );
    const json = JSON.parse(r);
    if (!json.query || !json.query.search || json.query.search.length === 0) return [];
    const titles = json.query.search.map(s => s.title).join("|");
    const r2 = await proxyGet(
      "https://commons.wikimedia.org/w/api.php?action=query&titles=" + encodeURIComponent(titles) + "&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json"
    );
    const json2 = JSON.parse(r2);
    const pages = json2.query ? Object.values(json2.query.pages) : [];
    return pages.filter(p => p.imageinfo).map(p => p.imageinfo[0].thumburl || p.imageinfo[0].url);
  } catch(e) {
    return [];
  }
}

const items = [
  { name: "panda", q: "Chengdu panda breeding base" },
  { name: "kuanzhai", q: "Kuanzhai Alley Chengdu" },
  { name: "jinli", q: "Jinli Street Chengdu" },
  { name: "wuhou", q: "Wuhou Shrine Chengdu" },
  { name: "dufu", q: "Du Fu Thatched Cottage" },
  { name: "chunxi", q: "Chunxi Road Chengdu" },
  { name: "renmin", q: "People's Park Chengdu" },
  { name: "dujiangyan", q: "Dujiangyan" },
  { name: "qingcheng", q: "Mount Qingcheng" },
  { name: "dongjiao", q: "Dongjiao Memory Chengdu" },
  { name: "hotpot", q: "Sichuan hotpot" },
  { name: "chuanchuan", q: "Chuan chuan xiang" },
  { name: "dandan", q: "Dan dan noodles" },
  { name: "chaoshou", q: "Sichuan wonton red oil" },
  { name: "zhongjiao", q: "Zhong dumplings" },
  { name: "mapo", q: "Mapo tofu" },
  { name: "feipian", q: "Fuqi feipian" },
  { name: "tuto", q: "Rabbit head Sichuan food" },
  { name: "tianshui", q: "Tian shui noodles" },
  { name: "bingfen", q: "Bingfen ice jelly" },
];

(async () => {
  const results = {};
  for (const item of items) {
    const urls = await searchFiles(item.q);
    results[item.name] = urls[0] || "NOT_FOUND";
    // small delay to be polite
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(JSON.stringify(results, null, 2));
})();
