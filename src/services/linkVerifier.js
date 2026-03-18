import axios from "axios";
import { REAL_USER_AGENT } from "../config/env.js";

export async function verifyLinkDeadLogic(url, type = "POLICY") {
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
