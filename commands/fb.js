// ==============================================
// 📘 Azahrabot Facebook Downloader (v10.9 — Silent Console Clean)
// ✅ Works with KimKiro XYRO API & Facebook CDN
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");

function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Expand Facebook shortlinks (share/v/, etc.)
async function expandFacebookUrl(url) {
  try {
    const res = await axios.get(url, { maxRedirects: 0, validateStatus: null });
    const loc = res.headers.location;
    if (loc && loc.startsWith("http")) {
      console.log("🔗 Expanded Facebook shortlink");
      return loc;
    }
  } catch {}
  return url;
}

// Match any Facebook link (reel, fb.watch, etc.)
function extractFacebookUrl(text = "") {
  const fbRegex =
    /(https?:\/\/(?:www\.|m\.|fb\.|web\.|l\.)?(facebook\.com|fb\.watch)[^\s]*)/i;
  const match = text.match(fbRegex);
  return match ? match[0].split("?")[0] : null;
}

// Recursively collect media URLs
function collectMediaUrls(obj) {
  const urls = new Set();
  const mediaHint =
    /\.(mp4|webm|mov|jpg|jpeg|png|webp)|fbcdn|snapcdn|video|akamai/i;

  const visit = (val) => {
    if (!val) return;
    if (typeof val === "string") {
      const t = val.trim();
      if (t.startsWith("http") && mediaHint.test(t)) urls.add(t);
      const rx = /(https?:\/\/[^\s"']{15,400})/g;
      let m;
      while ((m = rx.exec(t))) {
        const s = m[1];
        if (mediaHint.test(s)) urls.add(s);
      }
    } else if (Array.isArray(val)) val.forEach(visit);
    else if (typeof val === "object") Object.values(val).forEach(visit);
  };
  visit(obj);
  return Array.from(urls);
}

// Download with retry + headers
async function downloadMedia(url, destPath) {
  const headers1 = {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Mobile Safari/537.36",
    Accept: "*/*",
    Referer: "https://www.facebook.com/",
  };
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: headers1,
      timeout: 30000,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const type = (res.headers["content-type"] || "").toLowerCase();
    if (!type.startsWith("video/") && !type.startsWith("image/"))
      throw new Error("Invalid media type");
    fs.writeFileSync(destPath, Buffer.from(res.data));
  } catch {
    const headers2 = {
      "User-Agent":
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext/)",
      Accept: "*/*",
      Referer: "https://m.facebook.com/",
    };
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: headers2,
      timeout: 30000,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    fs.writeFileSync(destPath, Buffer.from(res.data));
  }
}

module.exports = async (sock, msg, from) => {
  try {
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const fbUrl = extractFacebookUrl(text);

    if (!fbUrl) {
      await sock.sendMessage(
        from,
        {
          text:
            "❌ Invalid Facebook URL.\nExample:\n`.fb https://www.facebook.com/share/v/...`\n`.fb https://fb.watch/.../`",
        },
        { quoted: msg }
      );
      return;
    }

    const finalUrl = await expandFacebookUrl(fbUrl);
    await sock.sendMessage(from, { react: { text: "📘", key: msg.key } });

    const apiUrl = `https://api.xyro.site/download/facebook?url=${encodeURIComponent(
      finalUrl
    )}`;
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13; Pixel 8 Pro) AppleWebKit/537.36 Chrome/121 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      timeout: 25000,
      validateStatus: () => true,
    });

    let data;
    try {
      data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } catch {
      await sock.sendMessage(
        from,
        { text: "⚠️ Failed to parse Facebook response — invalid data." },
        { quoted: msg }
      );
      return;
    }

    const mediaUrls = collectMediaUrls(data);
    if (!mediaUrls.length) {
      await sock.sendMessage(
        from,
        { text: "⚠️ No downloadable Facebook media found — might be private." },
        { quoted: msg }
      );
      return;
    }

    // prefer fbcdn or mp4 first
    const best =
      mediaUrls.find((u) => u.includes("fbcdn") && u.endsWith(".mp4")) ||
      mediaUrls.find((u) => u.endsWith(".mp4")) ||
      mediaUrls.find((u) => u.includes("snapcdn")) ||
      mediaUrls[0];

    const tempDir = ensureTempDir();
    const filePath = path.join(tempDir, `fb_${Date.now()}.mp4`);
    await downloadMedia(best, filePath);

    const buffer = fs.readFileSync(filePath);
    await sock.sendMessage(
      from,
      { video: buffer, caption: "📥 *Downloaded by Azahra Bot (Facebook)*" },
      { quoted: msg }
    );

    fs.unlinkSync(filePath);
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    await sock.sendMessage(
      from,
      { text: "❌ Failed to download Facebook media — please try again later." },
      { quoted: msg }
    );
  }
};
