import "dotenv/config";

export const DISCORD_ID = process.env.DISCORD_ID;
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
export const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
export const SHEET_NAMES = (process.env.SHEET_NAMES || "Product Auto")
  .split(",")
  .map((s) => s.trim());
export const DATA_RANGE = process.env.DATA_RANGE;

/** When true, rows are checked only if the Job column (default O) is exactly "Yes". */
export const ONLY_WHEN_JOB_YES = process.env.ONLY_WHEN_JOB_YES === "true";

function columnLettersToZeroIndex(letters) {
  let result = 0;
  const s = String(letters)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  for (let i = 0; i < s.length; i++) {
    result = result * 26 + (s.charCodeAt(i) - 64);
  }
  return result - 1;
}

/** First column letters in A1 range (e.g. B2:O100 → B). */
function parseRangeStartColumnLetters(dataRange) {
  const m = String(dataRange ?? "").trim().match(/^([A-Za-z]+)/);
  return m ? m[1] : null;
}

const _explicitJob = process.env.JOB_COLUMN_INDEX;
const _hasExplicitJobIdx =
  _explicitJob !== undefined && String(_explicitJob).trim() !== "";
const _jobColLetter = (process.env.JOB_COLUMN_LETTER || "O").trim();

/**
 * 0-based index of Job column within each row returned for DATA_RANGE.
 * If JOB_COLUMN_INDEX is unset, derived from range start + JOB_COLUMN_LETTER (default O).
 */
export const JOB_COLUMN_INDEX = (() => {
  if (_hasExplicitJobIdx) {
    const p = parseInt(_explicitJob, 10);
    return Number.isFinite(p) ? p : 14;
  }
  const startCol = parseRangeStartColumnLetters(process.env.DATA_RANGE);
  if (!startCol) return 14;
  return (
    columnLettersToZeroIndex(_jobColLetter) -
    columnLettersToZeroIndex(startCol)
  );
})();

export const REAL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
