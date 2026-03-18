import { google } from "googleapis";
import { launchBrowser } from "./utils/browser.js";
import { verifyLinkDeadLogic } from "./services/linkVerifier.js";
import { sendBulkDiscordAlert } from "./services/discordNotifier.js";
import { getSheetRows } from "./services/googleSheets.js";
import { SHEET_NAMES, DATA_RANGE, REAL_USER_AGENT } from "./config/env.js";
import { asyncPool } from "./utils/pool.js";

// Simple delay utility (used to avoid rate limit / blocking)
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Limit number of concurrent browser pages
const CONCURRENCY = 3;

function normalizeUrl(url) {
  if (!url) return null;

  // Remove leading/trailing spaces
  let clean = url.trim();

  if (!clean) return null;

  // Add https
  if (!/^https?:\/\//i.test(clean)) {
    clean = "https://" + clean;
  }

  return clean;
}

async function checkApps() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "src/credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const browser = await launchBrowser();
  const errorList = [];

  for (const sheetName of SHEET_NAMES) {
    console.log(`\n--- 📊 Checking Sheet: ${sheetName} ---`);

    const range = `'${sheetName}'!${DATA_RANGE}`;

    const rows = await getSheetRows(auth, range);

    if (!rows || rows.length === 0) {
      console.log(`[${sheetName}] no data.`);
      continue;
    }

    await asyncPool(CONCURRENCY, rows, async (row, index) => {
      const taskId = index + 1; // unique id per task

      const [appId, os, appName, rawUrl] = row;
      const fullUrl = normalizeUrl(rawUrl);

      // CASE: content in 3 column are empty
      const isEmptyRow =
        (!appId || !appId.trim()) &&
        (!appName || !appName.trim()) &&
        (!rawUrl || !rawUrl.trim());

      if (isEmptyRow) {
        console.log(`[${taskId}][${sheetName}] ⏭️ Skip empty row`);
        return;
      }

      // CASE: missing or invalid URL
      if (!fullUrl) {
        console.log(`[${taskId}][${sheetName}] ❌ MISSING STORE URL`);

        errorList.push({
          name: appName || appId || "Unknown",
          sheetName,
          os,
          id: null,
          status: "MISSING STORE URL",
          msg: "Store URL is empty or invalid",
        });

        return;
      }

      const prefix = `[${taskId}][${sheetName}]`; // unified log prefix

      const page = await browser.newPage();
      await page.setUserAgent({ userAgent: REAL_USER_AGENT });

      let extractedLinks = null;

      try {
        console.log(`${prefix} 🚀 Start: ${appName || appId}`);
        console.log(`${prefix} ➡️ URL: ${fullUrl}`);

        await page.goto(fullUrl, {
          waitUntil: "networkidle2",
          timeout: 50000,
        });

        console.log(`${prefix} ✅ Page loaded`);

        // Handle Google Play expand
        if (fullUrl.includes("play.google.com")) {
          try {
            const expandBtn = 'button[aria-controls="developer-contacts"]';
            await page.waitForSelector(expandBtn, { timeout: 5000 });
            await page.click(expandBtn);
            await delay(1000);
            console.log(`${prefix} 🔽 Expanded developer section`);
          } catch (e) {
            console.log(`${prefix} ⚠️ No expand button`);
          }
        }

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

        console.log(`${prefix} 🔗 Extracted:`, extractedLinks);
      } catch (e) {
        console.log(`${prefix} ❌ STORE ERROR: ${e.message}`);

        errorList.push({
          name: appName || appId,
          sheetName: sheetName,
          os,
          id: fullUrl,
          status: "STORE ERROR",
          msg: e.message,
        });
      } finally {
        await page.close();
      }

      // --- LINK VERIFICATION ---
      if (extractedLinks) {
        // POLICY
        if (extractedLinks.policy) {
          console.log(`${prefix} 🔎 POLICY: ${extractedLinks.policy}`);

          const policyCheck = await verifyLinkDeadLogic(
            extractedLinks.policy,
            "POLICY",
          );

          if (policyCheck.isDead) {
            console.log(`${prefix} ❌ POLICY DOWN: ${policyCheck.msg}`);

            errorList.push({
              name: appName || appId,
              sheetName: sheetName,
              os,
              id: fullUrl,
              status: "POLICY DOWN",
              link: extractedLinks.policy,
              msg: policyCheck.msg,
            });
          } else {
            console.log(`${prefix} ✅ POLICY OK`);
          }
        } else {
          console.log(`${prefix} ⚠️ MISSING POLICY`);
          errorList.push({
            name: appName || appId,
            sheetName: sheetName,
            os,
            id: fullUrl,
            status: "MISSING POLICY",
            msg: "No policy link found on store page",
          });
        }

        // ADS.TXT
        if (extractedLinks.website) {
          try {
            const baseUrl = new URL(extractedLinks.website).origin;
            const adsTxtUrl = `${baseUrl.replace(/\/$/, "")}/app-ads.txt`;

            console.log(`${prefix} 🔎 ADS: ${adsTxtUrl}`);

            const adsCheck = await verifyLinkDeadLogic(
              adsTxtUrl,
              "APP-ADS.TXT",
            );

            if (adsCheck.isDead) {
              console.log(`${prefix} ❌ ADS DOWN: ${adsCheck.msg}`);
              if (
                adsCheck.msg.includes("socket hang up") ||
                adsCheck.msg.includes("ECONNRESET") ||
                adsCheck.msg.includes("timeout")
              ) {
                errorList.push({
                  name: appName || appId,
                  id: fullUrl,
                  os,
                  sheetName: sheetName,
                  status: "NETWORK UNSTABLE",
                  link: adsTxtUrl,
                  msg: adsCheck.msg,
                });
              } else {
                errorList.push({
                  name: appName || appId,
                  id: fullUrl,
                  os,
                  sheetName: sheetName,
                  status: "APP-ADS.TXT DOWN",
                  link: adsTxtUrl,
                  msg: adsCheck.msg,
                });
              }
            } else {
              console.log(`${prefix} ✅ ADS OK`);
            }
          } catch (urlErr) {
            console.log(`${prefix} ⚠️ INVALID WEBSITE URL`);
          }
        } else {
          console.log(`${prefix} ⚠️ MISSING WEBSITE`);
        }
      } else {
        console.log(`${prefix} ❌ EXTRACT FAILED`);
      }

      await delay(500);

      console.log(`${prefix} 🏁 Done\n`);
    });
  }

  await browser.close();
  if (errorList.length) await sendBulkDiscordAlert(errorList);
  console.log("🏁 Audit process finished.");
}

checkApps();
