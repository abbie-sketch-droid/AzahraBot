// commands/tt.js
// 🎵 Azahrabot TikTok Downloader (v8.4 — Final KimKiro XYRO Patch)
// Works with short links like https://vt.tiktok.com/... and full tiktok.com URLs

const fs = require("fs");
const path = require("path");
const axios = require("axios");

function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 🧩 Parse XYRO’s new TikTok JSON (Nov 2025 format)
function extractXYROMedia(data) {
  const urls = [];

  if (data?.result?.media && Array.isArray(data.result.media)) {
    for (const m of data.result.media) {
      if (typeof m === "string") urls.push(m);
      else if (m?.url) urls.push(m.url);
      else if (m?.download_url) urls.push(m.download_url);
      else if (m?.no_watermark) urls.push(m.no_watermark);
    }
  }

  if (data?.result?.url) urls.push(data.result.url);
  if (data?.result?.download_url) urls.push(data.result.download_url);
  if (data?.result?.video_url) urls.push(data.result.video_url);

  return Array.from(new Set(urls.filter((u) => typeof u === "string" && u.startsWith("http"))));
}

// 🌐 Expand TikTok short links (vt./vm.)
async function expandTikTokUrl(url) {
  if (!url.includes("vt.tiktok.com") && !url.includes("vm.tiktok.com")) return url;
  try {
    const res = await axios.get(url, { maxRedirects: 0, validateStatus: null });
    const loc = res.headers.location;
    if (loc && loc.startsWith("http")) {
      console.log("🔗 Expanded shortlink →", loc);
      return loc;
    }
  } catch (e) {
    console.warn("⚠️ Couldn’t expand shortlink:", e.message);
  }
  return url;
}

// 📥 Download TikTok media
async function downloadMedia(url, destPath) {
  const res = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      Referer: "https://www.tiktok.com/",
      Accept: "*/*",
    },
    timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const type = (res.headers["content-type"] || "").toLowerCase();
  if (!type.startsWith("video/") && !type.startsWith("image/")) {
    throw new Error(`Invalid media type: ${type}`);
  }

  fs.writeFileSync(destPath, Buffer.from(res.data));
}

module.exports = async (sock, msg, from) => {
  try {
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const match = text.match(
      /(https?:\/\/(?:www\.|vt\.|vm\.)?tiktok\.com\/[^\s]+)/i
    );

    if (!match) {
      await sock.sendMessage(
        from,
        {
          text:
            "❌ Invalid TikTok URL.\nExample:\n`.tt https://vt.tiktok.com/abc123/`\nor `.tt https://www.tiktok.com/@user/video/1234567890`",
        },
        { quoted: msg }
      );
      return;
    }

    let ttUrl = match[0];
    ttUrl = await expandTikTokUrl(ttUrl); // 🌐 expand short link

    await sock.sendMessage(from, { react: { text: "🎵", key: msg.key } });

    const apiUrl = `https://api.xyro.site/download/tiktok?url=${encodeURIComponent(ttUrl)}`;
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      timeout: 20000,
      validateStatus: () => true,
    });

    console.log("⚡ XYRO status:", res.status, res.headers["content-type"]);
    console.log("⚡ XYRO snippet:", String(res.data).slice(0, 400));

    let data;
    try {
      data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } catch {
      await sock.sendMessage(from, {
        text: "⚠️ Failed to parse TikTok response — invalid data from XYRO API.",
      }, { quoted: msg });
      return;
    }

    const mediaUrls = extractXYROMedia(data);
    if (!mediaUrls.length) {
      await sock.sendMessage(from, {
        text: "⚠️ No downloadable TikTok video found — the link might be private or region-locked.",
      }, { quoted: msg });
      return;
    }

    const tempDir = ensureTempDir();
    const bestUrl =
      mediaUrls.find((u) => u.includes("no_watermark")) ||
      mediaUrls.find((u) => u.includes(".mp4")) ||
      mediaUrls[0];

    const filePath = path.join(tempDir, `tiktok_${Date.now()}.mp4`);
    await downloadMedia(bestUrl, filePath);

    const buffer = fs.readFileSync(filePath);
    await sock.sendMessage(
      from,
      {
        video: buffer,
        caption: "📥 *Downloaded by AzahraBot (No Watermark)*",
      },
      { quoted: msg }
    );

    fs.unlinkSync(filePath);
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("❌ TikTok Command Error:", err.message);
    await sock.sendMessage(
      from,
      {
        text: "❌ Failed to download TikTok video — please try again later.",
      },
      { quoted: msg }
    );
  }
};
