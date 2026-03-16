import axios from "axios";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { google } from "googleapis";

// --- CONFIGURATION ---
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1481232302439923783/JrKu-jsqPO5yatg_Me4DrmonfPRfDJBrFwY0pJBLBOU7vyo94qKgnfkd7qd5yjMuYMLi";
const SPREADSHEET_ID = "1C1H_6cD_p6ovwGs8MblqwLCaarMdVYonwqvxbWjpREM";
const RANGE_READ = "'Product Auto'!C2:D100";
const REAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

puppeteer.use(StealthPlugin());

/**
 * Core Logic: Verifies if a link is dead using HTTP Fetch (Axios)
 * Instead of a full browser, this checks Status Codes and HTML Source keywords.
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
    const finalUrl = response.request.res.responseUrl || url;

    // 1. Kiểm tra HTTP Status
    if (statusCode >= 400) return { isDead: true, msg: `HTTP ${statusCode}` };

    // 2. Kiểm tra Redirect về trang Policy chung
    if (finalUrl.includes("policies.google.com/privacy")) {
      return { isDead: true, msg: "Redirected to generic Google Privacy" };
    }

    if (type === "APP-ADS.TXT") {
      const hasAdKeywords =
        content.includes("direct") ||
        content.includes("reseller") ||
        content.includes("pub-");
      if (!hasAdKeywords || content.length < 20)
        return { isDead: true, msg: "Invalid ads.txt format" };
    } else {
      // --- LOGIC POLICY SIÊU NHẠY ---

      // Lấy Title của trang để check (Title là thứ khó làm giả nhất)
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : "";

      // Dấu hiệu 1: Title chứa lỗi (Dành cho trang Google Robot trong ảnh f1d041.png)
      const isErrorTitle =
        pageTitle.includes("đã xảy ra lỗi") ||
        pageTitle.includes("error 404") ||
        pageTitle.includes("not found");

      // Dấu hiệu 2: Regex bắt cụm 404 trong thẻ <b> (có xử lý khoảng trắng)
      // Google Robot thường dùng: <b>404.</b> <ins>That’s an error.</ins>
      const isGoogleRobot404 =
        /<b>\s*404\.?\s*<\/b>/i.test(content) ||
        content.includes("that’s an error") ||
        content.includes("đó là một lỗi");

      // Dấu hiệu 3: Từ khóa chết chóc (quét cả dấu và không dấu)
      const deathKeywords = [
        "không tìm thấy url",
        "khong tim thay url",
        "đã xảy ra lỗi",
        "da xay ra loi",
        "trang web này chưa được công bố",
        "chưa được xuất bản",
        "the requested url was not found",
        "tài liệu bạn yêu cầu đã bị xóa",
        "sign in - google accounts",
        "đăng nhập - tài khoản google",
      ];
      const hasDeathKeyword = deathKeywords.some((kw) => content.includes(kw));

      // Dấu hiệu 4: Kiểm tra độ dài và "Google Synthesized"
      // Trang lỗi Google cực kỳ ngắn (thường < 1500 ký tự)
      const isSuspiciouslyShort =
        content.length < 1800 &&
        (content.includes("404") || content.includes("error"));

      // LOG ĐỂ DEBUG
      if (
        !isErrorTitle &&
        !isGoogleRobot404 &&
        !hasDeathKeyword &&
        !isSuspiciouslyShort
      ) {
        console.log(
          `[DEBUG] Valid Link: ${url} - Length: ${content.length} - Title: ${pageTitle}`,
        );
      }

      if (
        isErrorTitle ||
        isGoogleRobot404 ||
        hasDeathKeyword ||
        isSuspiciouslyShort
      ) {
        return {
          isDead: true,
          msg: `Google Site Dead (Captured by: ${isErrorTitle ? "Title" : "Content"})`,
        };
      }
    }

    return { isDead: false };
  } catch (e) {
    return { isDead: true, msg: e.message };
  }
}

async function sendBulkDiscordAlert(errorList) {
  if (errorList.length === 0) return;

  // 1. Nhóm lỗi theo Status (ví dụ: POLICY DOWN, ADS DOWN)
  const groupedErrors = errorList.reduce((acc, err) => {
    if (!acc[err.status]) acc[err.status] = [];
    acc[err.status].push(err);
    return acc;
  }, {});

  // 2. Tạo danh sách các Fields cho Embed
  const fields = Object.entries(groupedErrors).map(([status, apps]) => {
    const icon = status.includes("ADS") ? "📄" : "⚖️";

    // Tạo nội dung danh sách app cho mỗi loại lỗi
    const appLinks = apps
      .map((app) => {
        const name = app.name || "Unknown App";
        // Gom link store và link lỗi vào cùng một dòng để gọn
        return `• **${name}**: [Store](${app.id}) | [Link](${app.link || app.policyUrl || "N/A"})`;
      })
      .join("\n");

    return {
      name: `${icon} ${status} (${apps.length})`,
      value: appLinks,
      inline: false,
    };
  });

  // 3. Gửi Embed tổng hợp
  const embed = {
    title: "🚨 SYSTEM AUDIT REPORT",
    description: `Phát hiện **${errorList.length}** vấn đề tại sheet **Product Auto**.`,
    color: 0xff0000, // Màu đỏ nổi bật
    fields: fields,
    footer: {
      text: "Automated Audit System • GitHub Actions",
    },
    timestamp: new Date(),
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { embeds: [embed] });
  } catch (e) {
    console.error("❌ Không thể gửi thông báo Discord:", e.message);
  }
}

async function checkApps() {
  const auth = new google.auth.GoogleAuth({
    keyFile: "src/credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_READ,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return;

  // We still need Puppeteer ONLY for the Store page (to find the links)
  // because Store pages are highly dynamic and hard to fetch via Axios.
  const browser = await puppeteer.launch({
    // headless: false,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const errorList = [];

  for (const row of rows) {
    const [appName, fullUrl] = row;
    if (!fullUrl) continue;

    const page = await browser.newPage();
    await page.setUserAgent(REAL_USER_AGENT);

    let extractedLinks = null;
    try {
      console.log(`🚀 Extracting links from Store: ${fullUrl}`);
      await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 50000 });

      if (fullUrl.includes("play.google.com")) {
        try {
          const expandBtn = 'button[aria-controls="developer-contacts"]';
          await page.waitForSelector(expandBtn, { timeout: 5000 });
          await page.click(expandBtn);
          await delay(1000);
        } catch (e) {}
      }

      extractedLinks = await page.evaluate(() => {
        const isApple = window.location.hostname.includes("apple.com");

        // Tìm tất cả các link có data-test-id là "external-link" như trong HTML bạn gửi
        const externalLinks = Array.from(
          document.querySelectorAll('a[data-test-id="external-link"]'),
        );

        let policy = null;
        let website = null;

        if (isApple && externalLinks.length > 0) {
          // 1. Tìm link Website: chứa text "Developer Website"
          const wLink = externalLinks.find((a) =>
            a.innerText.includes("Developer Website"),
          );
          if (wLink) website = wLink.href;

          // 2. Tìm link Policy: chứa text "Privacy Policy"
          const pLink = externalLinks.find((a) =>
            a.innerText.includes("Privacy Policy"),
          );
          if (pLink) policy = pLink.href;
        }

        // LOGIC DỰ PHÒNG: Nếu là Google Play hoặc Apple đời cũ (không có data-test-id)
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

          if (!policy) policy = getValid(allAnchors, ["privacy", "chính sách"]);
          if (!website)
            website = getValid(allAnchors, ["website", "trang web"]);
        }

        return { policy, website };
      });
    } catch (e) {
      errorList.push({
        name: appName,
        id: fullUrl,
        status: "STORE ERROR",
        msg: e.message,
      });
    } finally {
      await page.close();
    }

    // --- VERIFICATION USING FETCH LOGIC ---
    if (extractedLinks) {
      // 1. Check Privacy Policy
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
            id: fullUrl,
            status: "POLICY DOWN",
            policyUrl: extractedLinks.policy,
            msg: policyCheck.msg,
          });
        } else {
          // Thêm dòng này để chắc chắn bạn thấy nó có check
          console.log(`✅ POLICY Valid: ${extractedLinks.policy}`);
        }
      } else {
        console.log(`⚠️ MISSING POLICY LINK: ${fullUrl}`);
        errorList.push({
          name: appName,
          id: fullUrl,
          status: "MISSING POLICY",
          msg: "No policy link found on store",
        });
      }

      // 2. Check App-ads.txt
      if (extractedLinks.website) {
        try {
          let baseUrl = new URL(extractedLinks.website).origin;
          const adsTxtUrl = `${baseUrl.replace(/\/$/, "")}/app-ads.txt`;
          const adsCheck = await verifyLinkDeadLogic(adsTxtUrl, "APP-ADS.TXT");

          if (adsCheck.isDead) {
            console.log(`❌ ADS DOWN: ${adsTxtUrl} (${adsCheck.msg})`);
            errorList.push({
              name: appName,
              id: fullUrl,
              status: "APP-ADS.TXT DOWN",
              policyUrl: adsTxtUrl,
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
    // Minimal delay between apps to respect Store rate limits
    await delay(2000);
  }

  await browser.close();
  if (errorList.length > 0) await sendBulkDiscordAlert(errorList);
  console.log("🏁 Audit process finished.");
}

checkApps();
