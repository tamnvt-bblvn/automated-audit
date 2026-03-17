import "dotenv/config";
import axios from "axios";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { google } from "googleapis";

// --- CONFIGURATION ---
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAMES_ENV = process.env.SHEET_NAMES || "Product Auto";
const SHEET_NAMES = SHEET_NAMES_ENV.split(",").map((s) => s.trim());
const DATA_RANGE = process.env.DATA_RANGE;
const REAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

puppeteer.use(StealthPlugin());

/**
 * Core Logic: Verifies if a link is active or dead.
 * Uses HTTP Fetch (Axios) to analyze Status Codes, Redirects, and Page Content.
 */
async function verifyLinkDeadLogic(url, type = "POLICY") {
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: false,
      headers: { "User-Agent": REAL_USER_AGENT },
    });

    const statusCode = response.status;
    const content = response.data.toString().toLowerCase();
    const finalUrl = (response.request.res.responseUrl || url).toLowerCase();

    // 1. Check HTTP Status Code
    if (statusCode >= 400) return { isDead: true, msg: `HTTP ${statusCode}` };

    // 2. Check for Redirects to Login or Generic Privacy pages (Common Google Sites death signs)
    if (
      finalUrl.includes("accounts.google.com") ||
      finalUrl.includes("service-login") ||
      finalUrl.includes("policies.google.com/privacy") ||
      finalUrl === "https://sites.google.com/view"
    ) {
      return { isDead: true, msg: "Redirected to Login/Generic Google page" };
    }

    if (type === "APP-ADS.TXT") {
      // Logic for app-ads.txt format validation
      const hasAdKeywords =
        content.includes("direct") ||
        content.includes("reseller") ||
        content.includes("pub-");
      if (!hasAdKeywords || content.length < 20)
        return { isDead: true, msg: "Invalid ads.txt format" };
    } else {
      // --- ADVANCED POLICY DETECTION LOGIC ---

      // Extract Page Title for validation
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : "";

      // List of keywords indicating a dead or unpublished Google Site
      const deathKeywords = [
        // "404",
        "error 404",
        "not found",
        "đã xảy ra lỗi",
        "da xay ra loi", // Vietnamese error variants
        "không tìm thấy url",
        "khong tim thay url",
        "the requested url was not found",
        "that’s an error",
        "đó là một lỗi",
        "trang web này chưa được công bố",
        "chưa được xuất bản",
        "sign in - google accounts",
        "đăng nhập - tài khoản google",
        "tài liệu bạn yêu cầu đã bị xóa",
      ];

      const matchedKeyword = deathKeywords.find(
        (kw) => content.includes(kw) || pageTitle.includes(kw),
      );

      // Detect Google's specific 404 Robot tag
      const isGoogleRobot404 = /<b>\s*404\.?\s*<\/b>/i.test(content);

      // Check for error keywords in Title or Body
      const isErrorTitle = deathKeywords.some((kw) => pageTitle.includes(kw));
      const hasDeathKeyword = deathKeywords.some((kw) => content.includes(kw));

      // Check for suspiciously short content (Common in error pages)
      const isSuspiciouslyShort =
        content.length < 1800 &&
        (content.includes("404") ||
          content.includes("error") ||
          content.includes("lỗi"));

      // Debug Log for Valid Links
      // --- LOG DEBUGGING ---
      if (matchedKeyword || isGoogleRobot404 || isSuspiciouslyShort) {
        let reason = "";
        if (matchedKeyword) reason = `Matched Keyword: [${matchedKeyword}]`;
        else if (isGoogleRobot404) reason = "Google Robot 404 Tag (<b>404</b>)";
        else if (isSuspiciouslyShort)
          reason = `Suspiciously Short (${content.length} chars) with Error keywords`;

        console.log(`❌ Link Dead Detection: ${url}`);
        console.log(`   👉 Reason: ${reason}`);
        console.log(`   👉 Final URL: ${finalUrl}`);

        return {
          isDead: true,
          msg: `Site Unreachable (Reason: ${reason})`,
        };
      }

      if (
        isErrorTitle ||
        isGoogleRobot404 ||
        hasDeathKeyword ||
        isSuspiciouslyShort
      ) {
        return {
          isDead: true,
          msg: `Site Unreachable (Detected by: ${isErrorTitle ? "Title" : "Content Analysis"})`,
        };
      }
    }

    return { isDead: false };
  } catch (e) {
    return { isDead: true, msg: e.message };
  }
}

/**
 * Sends a consolidated report to Discord grouped by error type.
 */
async function sendBulkDiscordAlert(errorList) {
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
      const sheetTag = app.sheetName ? `\`${app.sheetName}\`` : "";

      // Render ultra-compact format on a single line
      description += `- **${shortName}** ${sheetTag} 🔗 ${sLink} | ${lLink}\n`;
    });

    description += `\n`;
  }

  const embed = {
    title: "🚨 PROJECT OVERVIEW: LINK AUDIT",
    color: 0xe74c3c,
    description: description.substring(0, 4000),
    footer: { text: "System Monitor • Automated Audit" },
    timestamp: new Date(),
  };

  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, { embeds: [embed] });
    console.log("✅ Audit report sent successfully.");
  } catch (e) {
    console.error("❌ Discord Error:", e.response?.data || e.message);
  }
}

async function checkApps() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "src/credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Launch Puppeteer with necessary arguments for CI/CD environments
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const errorList = [];
  for (const sheetName of SHEET_NAMES) {
    console.log(`\n--- 📊 Checking Sheet: ${sheetName} ---`);

    const range = `'${sheetName}'!${DATA_RANGE}`;

    try {
      // Fetch data from Google Sheets
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log(`[${sheetName}] no data.`);
        continue;
      }

      for (const row of rows) {
        const [appName, fullUrl] = row;
        if (!fullUrl) continue;

        const page = await browser.newPage();
        await page.setUserAgent(REAL_USER_AGENT);

        let extractedLinks = null;
        try {
          console.log(`🚀 Extracting links from Store: ${fullUrl}`);
          await page.goto(fullUrl, {
            waitUntil: "networkidle2",
            timeout: 50000,
          });

          // Handle Google Play's dynamic contact section
          if (fullUrl.includes("play.google.com")) {
            try {
              const expandBtn = 'button[aria-controls="developer-contacts"]';
              await page.waitForSelector(expandBtn, { timeout: 5000 });
              await page.click(expandBtn);
              await delay(1000);
            } catch (e) {}
          }

          // Extract Privacy and Website links using Store-specific selectors
          extractedLinks = await page.evaluate(() => {
            const isApple = window.location.hostname.includes("apple.com");
            const externalLinks = Array.from(
              document.querySelectorAll('a[data-test-id="external-link"]'),
            );

            let policy = null;
            let website = null;

            if (isApple && externalLinks.length > 0) {
              const wLink = externalLinks.find((a) =>
                a.innerText.includes("Developer Website"),
              );
              if (wLink) website = wLink.href;

              const pLink = externalLinks.find((a) =>
                a.innerText.includes("Privacy Policy"),
              );
              if (pLink) policy = pLink.href;
            }

            // Fallback logic for Play Store or older App Store layouts
            if (!policy || !website) {
              const allAnchors = Array.from(document.querySelectorAll("a"));
              const getValid = (list, keywords) => {
                const found = list.find((a) => {
                  const text = a.innerText.toLowerCase();
                  const href = a.href.toLowerCase();
                  return (
                    keywords.some((k) => text.includes(k)) &&
                    href.startsWith("http") &&
                    !href.includes("apple.com") &&
                    !href.includes("google.com/privacy")
                  );
                });
                return found ? found.href : null;
              };

              if (!policy)
                policy = getValid(allAnchors, ["privacy", "chính sách"]);
              if (!website)
                website = getValid(allAnchors, ["website", "trang web"]);
            }

            return { policy, website };
          });
        } catch (e) {
          errorList.push({
            name: appName,
            sheetName: sheetName,
            id: fullUrl,
            status: "STORE ERROR",
            msg: e.message,
          });
        } finally {
          await page.close();
        }

        // --- LINK VERIFICATION PHASE ---
        if (extractedLinks) {
          // 1. Verify Privacy Policy
          if (extractedLinks.policy) {
            const policyCheck = await verifyLinkDeadLogic(
              extractedLinks.policy,
              "POLICY",
            );

            if (policyCheck.isDead) {
              console.log(
                `❌ POLICY DOWN: ${extractedLinks.policy} (${policyCheck.msg})`,
              );
              errorList.push({
                name: appName,
                sheetName: sheetName,
                id: fullUrl,
                status: "POLICY DOWN",
                link: extractedLinks.policy,
                msg: policyCheck.msg,
              });
            } else {
              console.log(`✅ POLICY Valid: ${extractedLinks.policy}`);
            }
          } else {
            console.log(`⚠️ MISSING POLICY LINK: ${fullUrl}`);
            errorList.push({
              name: appName,
              sheetName: sheetName,
              id: fullUrl,
              status: "MISSING POLICY",
              msg: "No policy link found on store page",
            });
          }

          // 2. Verify app-ads.txt
          if (extractedLinks.website) {
            try {
              const baseUrl = new URL(extractedLinks.website).origin;
              const adsTxtUrl = `${baseUrl.replace(/\/$/, "")}/app-ads.txt`;
              const adsCheck = await verifyLinkDeadLogic(
                adsTxtUrl,
                "APP-ADS.TXT",
              );

              if (adsCheck.isDead) {
                console.log(`❌ ADS DOWN: ${adsTxtUrl} (${adsCheck.msg})`);
                errorList.push({
                  name: appName,
                  id: fullUrl,
                  sheetName: sheetName,
                  status: "APP-ADS.TXT DOWN",
                  link: adsTxtUrl,
                  msg: adsCheck.msg,
                });
              } else {
                console.log(`✅ ADS Valid: ${adsTxtUrl}`);
              }
            } catch (urlErr) {
              console.log(`⚠️ INVALID WEBSITE URL: ${extractedLinks.website}`);
            }
          } else {
            console.log(`⚠️ MISSING WEBSITE: ${fullUrl}`);
          }
        } else {
          console.log(`❌ FAILED TO EXTRACT LINKS FOR: ${appName}`);
        }

        // Respect rate limits with a small delay
        await delay(2000);
      }
    } catch (err) {
      console.error(`❌ Read error sheet ${sheetName}:`, err.message);
    }
  }

  await browser.close();
  if (errorList.length > 0) await sendBulkDiscordAlert(errorList);
  console.log("🏁 Audit process finished.");
}

checkApps();
