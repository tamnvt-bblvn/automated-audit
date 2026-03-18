import axios from "axios";
import { DISCORD_WEBHOOK_URL } from "../config/env.js";

/**
 * Sends a consolidated report to Discord grouped by error type.
 */
export async function sendBulkDiscordAlert(errorList) {
  if (!errorList || errorList.length === 0) return;

  // 1. Group by status
  const grouped = errorList.reduce((acc, err) => {
    const status = (err.status || "Audit Alert").toUpperCase();
    if (!acc[status]) acc[status] = [];
    acc[status].push(err);
    return acc;
  }, {});

  let description = `### 📊 Summary: Found **${errorList.length}** issues\n\n`;

  // 2. Build Category content
  for (const [status, apps] of Object.entries(grouped)) {
    description += `📂 **Category: ${status}**\n`;

    apps.forEach((app) => {
      // Validate link data to prevent broken Markdown [Text]()
      const sLink =
        app.id && app.id.startsWith("http") ? `[Store](${app.id})` : "No Store";
      const lLink =
        app.link && app.link.startsWith("http")
          ? `[Link](${app.link})`
          : "No Link";

      // Optimize App Name: Truncate if too long (>25 chars) to prevent line breaks on UI
      const rawName = app.name || "Unknown";
      const shortName =
        rawName.length > 25 ? rawName.substring(0, 22) + "..." : rawName;

      // Ensure sheetTag is included for all categories
      const shortSheetName = app.sheetName
        ? app.sheetName.split(" ").pop() // Product Auto → Auto
        : null;

      const sheetTag = [
        shortSheetName ? `\`${shortSheetName}\`` : null,
        app.os ? `\`${app.os}\`` : null,
      ]
        .filter(Boolean)
        .join(" ");

      // Render ultra-compact format on a single line
      description += `- **${shortName}** ${sheetTag} 🔗 ${sLink} | ${lLink}\n`;
    });

    description += `\n`;
  }

  const embed = {
    title: "🚨 PROJECT OVERVIEW: LINK AUDIT WEB STORE",
    color: 0xe74c3c,
    description: description.substring(0, 4000),
    footer: { text: "System Monitor • Automated Audit" },
    timestamp: new Date(),
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
    console.log("✅ Audit report sent successfully.");
  } catch (e) {
    console.error("❌ Discord Error:", e.response?.data || e.message);
  }
}
