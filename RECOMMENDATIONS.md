# LoggerBOT — Code Review Recommendations

> Generated: 2026-07-19
> Scope: Full codebase review of `code.gs`, `app.js`, `index.html`, `FileHelper.gs`
> Status: **Pending verification — no code changes applied**

---

## Critical (breaks functionality, security, or data integrity)

### C1. Password-based authentication for all web app requests

**Current state:** Telegram webhook requests are authenticated via bot token. Web app requests to the `log` endpoint are completely unauthenticated — anyone with the deployed URL can inject entries.

**Recommendation:** Require a hashed password on every request. Store the hash in the Config tab of the Google Sheet (row key `PWD`). Verify on the backend before processing any endpoint.

**Design:**

1. **Config tab** — Add a row: `PWD` | `<sha256_hash>`
2. **Frontend** — User enters password in Settings tab. Hash it client-side via `subtleCrypto` (SHA-256), store the hash in `localStorage`. Send the hash + `chatId` in every request.
3. **Backend** — Read stored hash from Config tab. Compare with received hash. Reject on mismatch.
4. **Telegram webhook** — Bypass password check (still auth via bot token). Only web app requests require the password.

**Client-side hashing (app.js):**
```javascript
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Backend verification (code.gs — in doPost, before routing):**
```javascript
function verifyPassword(request) {
  const data = JSON.parse(request.postData.contents);
  const pwHash = data.passwordHash;
  if (!pwHash) return false;

  // Read stored hash from Config tab
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const values = sheet.getDataRange().getValues();
  let storedHash = null;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === 'PWD') {
      storedHash = String(values[i][1]);
      break;
    }
  }

  if (!storedHash) return false;
  return pwHash === storedHash;
}
```

**Settings tab changes:**
- Add a password input field (type `password`)
- On save, hash client-side → store in `localStorage` as `tg_pwhash`
- Send this hash as `passwordHash` in every POST body

**Initial setup:**
1. Pick a password (your chosen secret)
2. Hash it with any SHA-256 tool
3. Store the hash in the Config tab, row key `PWD`
4. Enter the plaintext password in the app Settings — it hashes and stores locally

**Impact:** Real authentication for the web app. Eliminates the open `log` endpoint.
**Risk:** Low — replaces the current `chatId`-only check with proper credential verification.

---

### C2. `generateNote()` — ReferenceError on non-hashtag text

**File:** `code.gs:513-528`

```javascript
function generateNote(strTextReceived, strTextExisting, strPhotoUrl, strFilename, strFileUrl) {
  // ...
  if (strNewText.startsWith("#")) {
    const arrNew = extractHashtags(strNewText);       // ← only defined here
    strTextReceived = findAndReturnAfterNewline(strNewText);
  }

  if (strOldText.startsWith("#")) {
    const arrOld = extractHashtags(strOldText);        // ← only defined here
    strTextExisting = findAndReturnAfterNewline(strOldText);
  }

  // ...
  const mergedTags = mergeAndSortArrays(arrOld, arrNew);  // ← ReferenceError!
```

`arrOld` and `arrNew` are scoped inside their respective `if` blocks. When either text doesn't start with `#`, the variable is `undefined` → `ReferenceError` on line 528. The entire `handleLog` pipeline crashes silently.

**Recommendation:** Initialize both arrays before the conditionals.

```javascript
let arrNew = [];
let arrOld = [];

if (strNewText.startsWith("#")) {
  arrNew = extractHashtags(strNewText);
  strTextReceived = findAndReturnAfterNewline(strNewText);
}

if (strOldText.startsWith("#")) {
  arrOld = extractHashtags(strTextExisting);
  strTextExisting = findAndReturnAfterNewline(strOldText);
}

const mergedTags = mergeAndSortArrays(arrOld, arrNew);
```

**Impact:** Fixes crashes when journaling plain text (no hashtags). Every message without `#` in either field triggers this.
**Risk:** None — defensive initialization that matches the intended logic.

---

### C3. `doGet` hits live Telegram API on every page load

**File:** `code.gs:123`

```javascript
const name = getMe().result.first_name;  // UrlFetchApp to Telegram every load
```

Every unauthenticated page load triggers a Telegram API call. Slow, unnecessary, and risks rate limits.

**Recommendation:** Hardcode the bot display name or cache via `PropertiesService`.

```javascript
const BOT_NAME = PropertiesService.getScriptProperties().getProperty('BOT_NAME') || 'LoggerBOT';
// ...
const name = BOT_NAME;
```

**Impact:** Eliminates ~1-2s delay on page load. Removes Telegram API dependency.
**Risk:** Low — bot name rarely changes.

---

## Medium (affects UX, correctness, or maintainability)

### M1. Hash password client-side — never send plaintext

**Follows from C1.** The frontend must hash the password via `crypto.subtle` (SHA-256) before it leaves the browser. The 64-char hex hash is what travels to GAS and what gets compared against the Config tab. Plaintext never touches the network, GAS logs, or Sheets.

**Impact:** Zero plaintext exposure anywhere in the pipeline.
**Risk:** None — `crypto.subtle` is available in all modern browsers (HTTPS required, which GAS provides).

---

### M2. Category selector sends `name` instead of `value`

**File:** `app.js:49`

The `<select>` uses `c.name` as the option value, but the backend stores categories by `value`. If `name ≠ value` (e.g., name="Work", value="work"), logged categories won't match any record.

**Recommendation:** `<option key={c.value} value={c.value}>{c.name}</option>`

**Impact:** Fixes category tagging accuracy. Mis-tagged entries become unsearchable.

---

### M3. `send()` reads configuration from DOM directly

**File:** `app.js:677-678`

Fallback to `document.getElementById('url')` is dead code — SettingsTab isn't mounted when `tab === 'input'`. Remove it; `url` and `cid` are already in React scope.

**Impact:** Eliminates a dead code path that could mask configuration issues.

---

### M4. `send()` clears file state before POST completes

**File:** `app.js:712-715`

`post().then()` clears `selectedFile`/`imagePreview` asynchronously. User can navigate between `finally` (unblocks UI) and `.then()` (clears state). Clear in `send()`'s `finally` instead.

**Impact:** Prevents lost uploads if user navigates during send.

---

### M5. Category fetch fires on every keystroke in Settings

**File:** `app.js:650-654`

`[tab, url, cid]` in `useEffect` deps means typing in Settings triggers `fetchCategories()` on every character. Deps should be `[tab]` only.

**Impact:** Eliminates unnecessary network requests during settings editing.

---

### M6. Camera inputs left in DOM despite buttons being disabled

**File:** `app.js:860-868`

Hidden `<input capture>` still mounts. Remove until camera capture is re-enabled.

**Impact:** Cleanup — prevents accidental camera invocation.

---

### M7. Dead code in `FileHelper.gs`

**File:** `FileHelper.gs:13-60`

`getFullFolderPathWithFilenameAndExtension()` calls `DriveApp.getFileById()` — the same OAuth scope issue fixed in `getDriveFileUrl()`. Would crash if called. Function is commented-out in test code but the function itself remains callable.

**Recommendation:** Move to `ARCHIVE/` or prefix with `DEPRECATED_` and add a warning comment.

**Impact:** Prevents future developers from calling broken code.

---

### M8. Duplicate comment

**File:** `app.js:673-674`

Two identical `// Send message with optional GPS location and optional image` lines. Delete one.

---

## Architecture Notes

### What's working well

- **No-build React SPA** — Babel standalone + Tailwind CDN. Fast iteration, zero build step
- **Dual entry points** — Telegram webhook (`doPost` router) and WebApp (`doGet`/`doPost` log). Clean separation
- **Image compression** — Client-side canvas resize before upload. Saves bandwidth and GAS execution time
- **Category persistence** — `localStorage` for last-selected category. Good UX detail
- **Drive URL workaround** — Constructing `drive.google.com/open?id=` directly avoids OAuth scope requirement
- **Photo data stripping** — Removing base64 from debug logs prevents Sheets 50K cell limit
- **Documentation** — `TECHNICAL_DOCS.md` is thorough and well-structured

### Structural concerns to watch

- **GAS 6-minute execution limit** — Current `handleLog` chain (Telegram API → Drive → Sheets × multiple ops) is a single synchronous flow. If any API call is slow, you risk timeout. Consider breaking into triggers or async queues for heavy operations.
- **Single Sheets row per entry** — `appendRow()` is correct, but note the 5-minute daily limit per cell for *cell edits*. Appends are fine, but bulk operations could hit quotas.
- **`no-cors` POST** — Web app can't read the response from GAS. Success/failure detection relies on optimistic UI. Acceptable for now, but means the user never sees a real server error.

---

## Quick-Win Summary

| # | Fix | File | Effort |
|---|-----|------|--------|
| C1 | Password auth (Config tab `PWD`, SHA-256 hash) | `code.gs` + `app.js` + Sheet | 45 min |
| C2 | Init `arrOld`/`arrNew` as `[]` | `code.gs` | 2 min |
| C3 | Cache `getMe()` / hardcode name | `code.gs` | 5 min |
| M1 | Client-side `crypto.subtle` SHA-256 hashing | `app.js` | 15 min |
| M2 | Category sends `value`, not `name` | `app.js` | 1 min |
| M3 | Remove DOM fallback in `send()` | `app.js` | 1 min |
| M4 | Clear file state in `finally` | `app.js` | 2 min |
| M5 | Debounce category fetch deps (`[tab]`) | `app.js` | 1 min |
| M6 | Remove dormant camera input | `app.js` | 1 min |
| M7 | Archive dead `FileHelper.gs` fn | `FileHelper.gs` | 1 min |
| M8 | Delete duplicate comment | `app.js` | 10 sec |

**Total estimated fix time: ~75 minutes**

---

## Verification Checklist

- [ ] C1 — Password-based auth (Config tab `PWD`, hash comparison)
- [ ] C2 — Fix `arrOld`/`arrNew` ReferenceError
- [ ] C3 — Cache `getMe()` result
- [ ] M1 — Client-side SHA-256 hashing
- [ ] M2 — Category `value` vs `name`
- [ ] M3 — Remove DOM fallback
- [ ] M4 — Clear file state in `finally`
- [ ] M5 — Debounce category fetch
- [ ] M6 — Remove dormant camera input
- [ ] M7 — Archive dead code
- [ ] M8 — Delete duplicate comment

Reply with the items you want implemented, or say "all" and I'll apply them.
