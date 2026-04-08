// ==============================================
// 🤖 Azahrabot — GPT Command (v6.8 Persistent Edition)
// Real chat memory stored in /data/gpt_memory.json
// ==============================================

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const secure = require("../lib/small_lib");
const settings = require("../settings");

const MEMORY_PATH = path.join(__dirname, "../data/gpt_memory.json");

// 🧠 Load memory on startup
let chatMemory = {};
if (fs.existsSync(MEMORY_PATH)) {
  try {
    chatMemory = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
  } catch {
    chatMemory = {};
  }
} else {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify({}, null, 2));
}

// 🧩 Save memory every 15s (or when updated)
function saveMemory() {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(chatMemory, null, 2));
  } catch (err) {
    console.error("⚠️ Failed to save GPT memory:", err.message);
  }
}

module.exports = async (sock, msg, from, text, args = []) => {
  const prompt = args.join(" ").trim();

  if (!prompt) {
    await sock.sendMessage(
      from,
      {
        text:
          `💬 *${secure.botName || "Azahra Bot"} GPT*\n\n` +
          `Type something after ${settings.prefix || "."}gpt like:\n` +
          `\`${settings.prefix || "."}gpt tell me a random fact\`\n` +
          `\`${settings.prefix || "."}gpt write a poem about friendship\``,
      },
      { quoted: msg }
    );
    return;
  }

  // React + typing
  await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } }).catch(() => {});
  await sock.sendPresenceUpdate("composing", from);

  const key = secure.api.openRouter || process.env.OPENROUTER_KEY;
  if (!key) {
    await sock.sendMessage(from, { text: "⚠️ Missing OpenRouter API key." }, { quoted: msg });
    return;
  }

  // 🧠 Initialize user memory
  if (!chatMemory[from]) chatMemory[from] = [];
  chatMemory[from].push({ role: "user", content: prompt });

  // Limit memory to last 15 messages
  if (chatMemory[from].length > 15)
    chatMemory[from].splice(0, chatMemory[from].length - 15);

  let reply = null;

  try {
    // 🥇 Primary: OpenRouter
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `${secure.botName || "AzahraBot"} — a friendly WhatsApp AI. 
Always keep responses short, realistic, and remember chat history for this user.`,
          },
          ...chatMemory[from],
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://openrouter.ai",
          "X-Title": `${settings.botName || "AzahraBot"} WhatsApp Bot`,
        },
        timeout: 45000,
      }
    );
    reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) console.log("✅ GPT Response via OpenRouter (Primary)");
  } catch (err) {
    console.error("⚠️ OpenRouter failed:", err.response?.data?.error?.message || err.message);
  }

  // 🥈 Fallback 1: EliteProTech
  if (!reply) {
    try {
      // Build string prompt from memory to preserve context
      const chatContext = chatMemory[from].map(m => `${m.role === 'user' ? 'User' : 'AzahraBot'}: ${m.content}`).join("\n");
      const fullPrompt = `System: ${secure.botName || "AzahraBot"} — a friendly WhatsApp AI. Keep responses short.\n\nChat:\n${chatContext}`;
      
      const res = await axios.get(`https://eliteprotech-apis.zone.id/chatgpt?prompt=${encodeURIComponent(fullPrompt)}`, { timeout: 30000 });
      reply = res.data?.response?.trim();
      if (reply) console.log("✅ GPT Response via EliteProTech (Fallback 1)");
    } catch (err) {
      console.error("⚠️ EliteProTech fallback failed:", err.message);
    }
  }

  // 🥉 Fallback 2: PrinceTechn
  if (!reply) {
    try {
      const chatContext = chatMemory[from].map(m => `${m.role === 'user' ? 'User' : 'AzahraBot'}: ${m.content}`).join("\n");
      const fullPrompt = `System: ${secure.botName || "AzahraBot"} — a friendly WhatsApp AI. Keep responses short.\n\nChat:\n${chatContext}`;
      
      const res = await axios.get(`https://api.princetechn.com/api/ai/gpt4o?apikey=prince&q=${encodeURIComponent(fullPrompt)}`, { timeout: 30000 });
      reply = res.data?.result?.trim();
      if (reply) console.log("✅ GPT Response via PrinceTechn (Fallback 2)");
    } catch (err) {
      console.error("⚠️ PrinceTechn fallback failed:", err.message);
    }
  }

  try {
    if (!reply) {
      reply = "😅 I couldn’t think of a reply right now. All AI servers are currently busy.";
    }

    chatMemory[from].push({ role: "assistant", content: reply });
    saveMemory(); // Save memory every message Update

    await sock.sendMessage(from, { text: reply }, { quoted: msg });
  } catch (err) {
    console.error("❌ Final GPT Error:", err.message);
    await sock.sendMessage(from, { text: "😕 AI servers are completely down — try again later." }, { quoted: msg });
  } finally {
    await sock.sendPresenceUpdate("paused", from);
  }
};
