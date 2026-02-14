// ==============================================
// 📸 Azahrabot Instagram Downloader (v11 — Pure XYRO Edition)
// Ultra-Stable: https://api.xyro.site/download/instagram?url=
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Ensure /temp exists
function ensureTempDir() {
  const dir = path.join(__dirname, "../temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// -----------------------------
// XYRO IG Fetcher
// -----------------------------
async function getMediaFromXYRO(igUrl) {
  const apiUrl = `https://api.xyro.site/download/instagram?url=${encodeURIComponent(igUrl)}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    Accept: "application/json",
    Referer: "https://api.xyro.site/",
    Origin: "https://api.xyro.site",
  };

  const res = await axios.get(apiUrl, {
    headers,
    timeout: 20000,
    validateStatus: () => true,
    responseType: "json",
  });

  const data = res.data;

  // ❗ XYRO sometimes returns stringified JSON
  let json;
  try {
    json = typeof data === "string" ? JSON.parse(data) : data;
  } catch (e) {
    throw new Error("Invalid JSON response from XYRO IG API");
  }

  // NEW XYRO Format → result.media[]
  if (json?.result?.media && Array.isArray(json.result.media)) {
    return json.result.media.filter((x) => typeof x === "string" && x.startsWith("http"));
  }

  // FALLBACK keys (old XYRO)
  const fallback = [
    ...(Array.isArray(json?.result) ? json.result : []),
    json?.result?.url,
    json?.url,
    json?.download_url,
    json?.result?.download_url,
  ].filter(Boolean);

  return fallback.filter((u) => typeof u === "string" && u.startsWith("http"));
}

// -----------------------------
// Download Media to temp folder
// -----------------------------
async function downloadMedia(url, dest) {
  const res = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
    timeout: 25000,
  });

  fs.writeFileSync(dest, Buffer.from(res.data));
}

// -----------------------------
// IG Command Handler
// -----------------------------
module.exports = async (sock, msg, from) => {
  try {
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    const match = text.match(
      /(https?:\/\/(?:www\.)?(instagram\.com|instagr\.am)\/[^\s]+)/i
    );

    if (!match) {
      return await sock.sendMessage(
        from,
        {
          text: "❌ Invalid Instagram URL.\nExample:\n`.ig https://www.instagram.com/reel/...`",
        },
        { quoted: msg }
      );
    }

    const igUrl = match[0];
    await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });
    await sock.sendMessage(from, { text: "📸 *Fetching Instagram media...*" }, { quoted: msg });

    // Fetch from XYRO
    const mediaUrls = await getMediaFromXYRO(igUrl);

    if (!mediaUrls.length) {
      return await sock.sendMessage(
        from,
        {
          text: "⚠️ No downloadable media found — post may be private.",
        },
        { quoted: msg }
      );
    }

    const tempDir = ensureTempDir();

    // Process all media files
    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      const isVideo = mediaUrl.includes(".mp4") || mediaUrl.includes("video");

      const fileExt = isVideo ? "mp4" : "jpg";
      const savePath = path.join(tempDir, `ig_${Date.now()}_${i}.${fileExt}`);

      try {
        await downloadMedia(mediaUrl, savePath);

        const buffer = fs.readFileSync(savePath);
        const caption = "📥 *Downloaded by Azahra Bot*";

        if (isVideo) {
          await sock.sendMessage(from, { video: buffer, caption }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });
        }

        fs.unlinkSync(savePath);
        await new Promise((r) => setTimeout(r, 700));
      } catch (err) {
        console.error("Media download error:", err.message);
      }
    }

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("❌ IG Error:", err.message);
    await sock.sendMessage(
      from,
      { text: "❌ Failed to download Instagram media." },
      { quoted: msg }
    );
  }
};
