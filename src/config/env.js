import "dotenv/config";

export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
export const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
export const SHEET_NAMES = (process.env.SHEET_NAMES || "Product Auto")
  .split(",")
  .map((s) => s.trim());
export const DATA_RANGE = process.env.DATA_RANGE;

export const REAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
