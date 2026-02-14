// ==============================================
// 🆔 Azahrabot JID Fetcher (v5.0 Pro Edition)
// Full coverage for user/group/channel JIDs
// ==============================================

const { jidNormalizedUser } = require("@whiskeysockets/baileys");

module.exports = async (sock, msg, from) => {
  try {
    await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
  } catch {}

  try {
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    let targetJid = null;

    // 1️⃣ Reply detection (best priority)
    targetJid =
      ctx.participant ||
      ctx.mentionedJid?.[0] ||
      ctx.remoteJid ||
      null;

    // 2️⃣ Newsletter forwarded message JID
    if (!targetJid && ctx?.forwardedNewsletterMessageInfo?.newsletterJid) {
      targetJid = ctx.forwardedNewsletterMessageInfo.newsletterJid;
    }

    // 3️⃣ Reacting to direct message origin
    if (!targetJid) targetJid = from;

    // 4️⃣ Normalize weird JIDs (c.us → s.whatsapp.net)
    if (targetJid.includes("@c.us")) {
      targetJid = jidNormalizedUser(targetJid);
    }

    // Final fallback
    if (!targetJid) targetJid = "❌ Unable to detect JID.";

    const type =
      targetJid.includes("@g.us")
        ? "Group"
        : targetJid.includes("@newsletter")
        ? "Channel"
        : targetJid.includes("@s.whatsapp.net")
        ? "User"
        : "Unknown";

    const resultText = `
🆔 *JID Information*
────────────────────
👤 *Detected JID:*
\`${targetJid}\`

📍 *Type:* ${type}
────────────────────
> ⚡ Powered by AzarTech
`.trim();

    await sock.sendMessage(from, { text: resultText }, { quoted: msg });
    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

  } catch (err) {
    console.error("❌ JID command failed:", err.message);
    await sock.sendMessage(from, {
      text: "⚠️ Failed to process JID. Try replying to a message.",
    }, { quoted: msg });
    await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
  }
};
