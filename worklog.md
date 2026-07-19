# Work Log

## 2026-07-19

### fix: strip photoData from debug log (b90d42e)
- **Problem:** `showDebug()` wrote full request body (including base64 image) to a single Sheets cell, which truncates at 50K characters — `photoData` and `photoName` were silently cut off.
- **Fix:** Detect `photoData` in `handleLog()` and replace with `[base64 image data omitted — N chars]` before writing to the debug cell.
- **File:** `code.gs`

### fix: construct Drive URL without DriveApp scope (8edb79a)
- **Problem:** `getDriveFileUrl()` called `DriveApp.getFileById()`, which requires the Drive OAuth scope — the deployed web app didn't have this scope, causing permission errors on photo uploads.
- **Fix:** Replace `DriveApp.getFileById(fileId).getUrl()` with direct URL construction: `` `https://drive.google.com/open?id=${fileId}` ``. Same output, no API call needed.
- **File:** `FileHelper.gs`

### fix: disable camera buttons temporarily (2265b5b)
- Commented out camera capture button and front/rear toggle in InputTab while troubleshooting permission issues.

### feat: persist last selected category to localStorage (6cf4514)
- **Problem:** Selected category was cleared after every log, requiring re-selection for each entry.
- **Fix:**
  1. Initialize `selectedCategory` from `localStorage.getItem('last_category')`
  2. `useEffect` saves category to localStorage on every change
  3. Removed `setSelectedCategory('')` from post-success callback
- **File:** `app.js`
