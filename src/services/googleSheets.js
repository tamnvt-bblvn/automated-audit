import { google } from "googleapis";
import { SPREADSHEET_ID } from "../config/env.js";

export async function getSheetRows(auth, range) {
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  return res.data.values || [];
}
