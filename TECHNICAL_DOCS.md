# LoggerBOT — Technical Documentation

> A mobile-first Progressive Web App paired with a Google Apps Script backend for capturing geotagged journal entries via Telegram. Deployed as a Google Sheets-bound script with Google Drive file storage.

---

## 1. System Architecture Overview

```
┌──────────────┐     HTTPS (no-cors)     ┌──────────────────────────────┐
│              │  ──────────────────────►  │  Google Apps Script (GAS)   │
│  React SPA   │                          │  (Web App Deployment)         │
│  app.js      │  ◄──────────────────────  │  code.gs                     │
│  index.html  │       JSON response       │                              │
└──────┬───────┘                          └──────────┬───────────────────┘
       │                                              │
       │   Telegram WebApp / Mobile Browser           │  UrlFetchApp
       │                                              │
       ├──────────────────────────────────────────────┤
       │                                              ▼
       │                                    ┌───────────────────┐
       │                                    │ Google Sheets     │
       │                                    │ (Messages,         │
       │                                    │  Categories,       │
       │                                    │  BOT Config,       │
       │                                    │  Thoughts, Debug)  │
       │                                    └────────┬──────────┘
       │                                             │
       │                                    ┌────────▼──────────┐
       │                                    │ Google Drive      │
       │                                    │ (Notes as .md,    │
       │                                    │  Photos, Files)    │
       │                                    └───────────────────┘
       │
       ▼
  Telegram Bot API
  (Webhook → GAS)
```

### 1.1 Three-Tier Design

| Tier | Technology | Role |
|------|-----------|------|
| **Frontend** | React 18 (CDN) + Babel Standalone + Tailwind CSS | Mobile SPA served from local file |
| **Backend** | Google Apps Script (Bound to Google Sheet) | REST-like API via `doGet`/`doPost` entrypoints |
| **Persistence** | Google Sheets (structured data) + Google Drive (files + Markdown notes) | Sheet-as-database, Drive-as-filestore |

### 1.2 Data Flow

1. User opens the React SPA (via Telegram WebApp or mobile browser).
2. SPA acquires GPS coordinates via `navigator.geolocation`.
3. SPA constructs a JSON payload (text + optional image + GPS + category).
4. SPA POSTs to the GAS Web App URL using `mode: 'no-cors'` (GAS limitation).
5. GAS routes the request: logs the message, saves photos/files to Drive, appends a Markdown note to a daily file in Drive, records a row in the Messages sheet, and sends a random thought back to Telegram.
6. When triggered by Telegram webhook, GAS processes incoming messages (photos, documents, text) through the same `handleLog` pipeline.

---

## 2. File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 26 | SPA shell — loads React, ReactDOM, Babel, Tailwind from CDN; mounts `app.js` |
| `app.js` | 739 | React application — state management, components, API calls, GPS, file upload |
| `code.gs` | 557 | Google Apps Script backend — all server logic |
| `test_api.html` | 199 | Standalone API testing utility for CRUD endpoints |
| `message.json` | 12 | Example structured payload format |
| `.gitignore` | 8 | Excludes `code.gs` (local copy), `.env`, `.DS_Store`, plan files |
| `.env` | — | Local environment variables (not committed) |
| `ARCHIVE/code.gs` | 546 | Previous version of the backend (for reference/rollback) |
| `app copy.js` | — | Stale frontend copy (not actively used) |
| `categories_crud_plan.md` | 416 | Implementation plan doc for the Categories CRUD feature |

---

## 3. Backend — `code.gs` (Google Apps Script)

### 3.1 Configuration Layer

All configuration is stored in a **`BOT` sheet** within the bound Google Spreadsheet. The `getConfig(key)` function reads this key-value table at runtime:

| Config Key | Description |
|-----------|-------------|
| `BOT_TOKEN` | Telegram Bot token (from BotFather) |
| `WEBAPP_URL` | Deployed GAS Web App URL (`https://script.google.com/macros/s/.../exec`) |
| `NOTES_FOLDER_PATH` | Google Drive folder path for daily Markdown notes |
| `FILES_SUBFOLDER` | Subfolder under notes for document attachments |
| `PHOTOS_SUBFOLDER` | Subfolder under notes for photographs |
| `DEBUG_SHEET` | Sheet name for debugging output |
| `MESSAGES_SHEET` | Sheet name for message log rows |
| `AUTHORIZED_CHAT_ID` | Allowed Chat ID for API access |
| `THOUGHTS_SHEET` | Sheet containing random response messages |

Derived constants:
```
FILES_FOLDER_PATH  = NOTES_FOLDER_PATH + "/" + FILES_SUBFOLDER
PHOTOS_FOLDER_PATH = NOTES_FOLDER_PATH + "/" + PHOTOS_SUBFOLDER
```

### 3.2 Spreadsheet Schema

#### Messages Sheet (logged by `handleLog`)
| Column A | Column B | Column C | Column D | Column E | Column F | Column G | Column H | Column I | Column J |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|----------|
| Timestamp | Chat ID | Category | Text | Photo URL | Filename | File URL | Note content | Location (lat,lon) | Note updated (bool) |

#### Categories Sheet (managed by CRUD endpoints)
| Column A (Name) | Column B (Value) | Column C (Desc) | Column D (Status) |
|-----------------|------------------|-----------------|-------------------|
| `Journal` | `journal` | Personal journal entries | `Active` |

`Value` serves as the unique key.

#### BOT Sheet (Configuration)
| Column A (Key) | Column B (Value) |
|---------------|-----------------|
| `BOT_TOKEN` | `...` |
| `AUTHORIZED_CHAT_ID` | `235221921` |

#### Thoughts Sheet
| Column A |
|----------|
| Random response text... |

### 3.3 Entry Points

#### `doGet(e)` — GET Requests
```
GET /exec?endpoint=getCategories&chatId=<ID>
```
- Routes to `handleGetCategories()` (after authorization check).
- Default fallback: calls Telegram `getMe` API and returns the bot's first name as plain text.

#### `doPost(e)` — POST Requests
Routes by `endpoint` (query parameter or body field):

| Endpoint | Authorization Required | Handler | Description |
|----------|----------------------|---------|-------------|
| `log` | No | `handleLog(data)` | Process incoming message (primary entry point) |
| `getCategories` | Yes | `handleGetCategories()` | Return all categories as JSON array |
| `createCategory` | Yes | `handleCreateCategory(data)` | Append new category row |
| `updateCategory` | Yes | `handleUpdateCategory(data)` | Update fields by `originalValue` |
| `deleteCategory` | Yes | `handleDeleteCategory(data)` | Soft-delete (set status to `Inactive`) |
| *(unknown)* | Yes | Returns error JSON | Unknown endpoint handling |

**Authorization Logic** (`checkAuthorization`):
- Reads `AUTHORIZED_CHAT_ID` from the BOT sheet.
- If not configured, access is open (fail-open design to prevent lockout).
- Checks incoming Chat ID from three sources in order: query param `chatId`, body field `chatId`, or nested `data.message.chat.id`.
- Compares as strings.

### 3.4 Message Processing Pipeline (`handleLog`)

```
Incoming data
    │
    ├─► Extract text, chatId, category, location
    │
    ├─► Photo detection (priority cascade):
    │   ├─ Telegram photo (data.message.photo)
    │   │   ├─ Fetch file via Telegram getFile API
    │   │   ├─ Download blob → save to Drive (PHOTOS folder)
    │   │   └─ Get Drive URL → set strPhotoUrl
    │   │
    │   └─ Direct base64 photo (data.message.photoData)
    │       ├─ Parse data URL → extract MIME + base64 payload
    │       ├─ Decode → create Blob → save to Drive
    │       └─ Get Drive URL → set strPhotoUrl
    │
    ├─► Document detection (data.message.document):
    │   ├─ Fetch via Telegram getFile API
    │   ├─ Download blob → save to Drive (FILES folder)
    │   └─ Get Drive URL → set strFileUrl
    │
    ├─► Note formatting:
    │   ├─ If file URL  → "\n{text} ![[{filename}]]"
    │   ├─ If photo URL → "\n{text} ![[{filename}]]"
    │   └─ Else         → formatNote(text) [YouTube link enrichment]
    │
    ├─► Append to daily Markdown file (Drive):
    │   └─ AppendToFile(NOTES_FOLDER_PATH, "YYYY-MM-DD.md", note)
    │
    ├─► Send Telegram response:
    │   ├─ Random thought from Thoughts sheet (if available)
    │   └─ Fallback: "Message received: {timestamp}"
    │
    └─► Log row to Messages sheet (10 columns)
        └─► Return { status: "success", photoUrl: "..." }
```

**File naming convention**:
- Photos: `PHOTO_{UUID}.jpg` (Telegram) or original filename (direct upload)
- Documents: `{UUID}_{original_filename}`

### 3.5 Utility Functions

| Function | Purpose |
|----------|---------|
| `getConfig(key)` | Lookup a key in the BOT sheet |
| `createJsonResponse(body)` | Return JSON via `ContentService` with correct MIME type |
| `getMe()` | Call Telegram Bot API `getMe` endpoint |
| `setWebhook()` | Register GAS URL as Telegram webhook |
| `removeWebhook()` | Remove Telegram webhook |
| `sendToken(chat_id, text)` | Send HTML-formatted message via Telegram Bot API |
| `getRandomThought()` | Randomly select a message from the Thoughts sheet |
| `showDebug(message)` | Write debug string to the Debug sheet |
| `getTelegramFile(fileId)` | Fetch file metadata from Telegram API |
| `saveFileToDrive(...)` | Download Telegram file → save to Drive folder |
| `saveBlobToDrive(...)` | Save a decoded blob directly to Drive folder |
| `findOrCreateFolderByPath(path)` | Create nested folder structure if it doesn't exist |
| `formatNote(text)` | Process text line-by-line; detect YouTube URLs and enrich with titles |
| `generateNote(...)` | Merge text + existing content with hashtag extraction |
| `TimeStamp()` / `DateStamp()` / `UniqueID()` | Utility functions (defined in original script, inherited) |

### 3.6 Menu System (`onOpen`)

Creates a custom menu in the Google Spreadsheet UI:
- **Run Scripts > getMe** — calls `getMe()` and shows result
- **Run Scripts > setWebhook** — registers the webhook
- **Run Scripts > removeWebhook** — removes the webhook

---

## 4. Frontend — `app.js` (React SPA)

### 4.1 Dependencies (CDN-loaded via `index.html`)

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18 (production UMD) | UI framework |
| ReactDOM | 18 (production UMD) | DOM rendering |
| Babel Standalone | Latest | In-browser JSX transformation |
| Tailwind CSS | CDN | Utility-first styling |

**No build step** — JSX is compiled at runtime by Babel in the browser. This enables single-file deployment but adds initial load overhead.

### 4.2 Component Architecture

```
App (root)
├── Toast (conditional overlay)
├── Header
│   ├── Title ("Universal Logger")
│   ├── Dark Mode Toggle
│   └── Hamburger Menu → Dropdown [Input, Categories, Settings, Log]
└── Content Area (tab-based)
    ├── InputTab
    ├── CategoriesTab
    ├── SettingsTab
    └── LogTab
```

### 4.3 State Management (`App` component)

All state lives in the root `App` component and is passed down as props:

| State Variable | Type | Source | Persistence |
|---------------|------|--------|-------------|
| `url` | `string` | `localStorage.getItem('tg_url')` | Persisted to `localStorage` |
| `cid` | `string` | `localStorage.getItem('tg_cid')` | Persisted to `localStorage` |
| `msg` | `string` | Default: `'Hello from iPhone mobile hardware!'` | Volatile |
| `logs` | `Array<{text, kind}>` | `[]` | Volatile (session-only) |
| `dark` | `boolean` | `false` | Volatile |
| `tab` | `string` | `'input'` (one of: `input`, `categories`, `settings`, `log`) | Volatile |
| `menuOpen` | `boolean` | `false` | Volatile |
| `loading` | `boolean` | `false` | Volatile |
| `loadingLabel` | `string` | `''` (e.g., `'Sending'`, `'Testing GPS'`, `'Saving'`) | Volatile |
| `toast` | `{msg, kind} \| null` | `null` | Volatile (auto-dismiss 3s) |
| `selectedFile` | `File \| null` | `null` | Volatile |
| `imagePreview` | `string \| null` (data URL) | `null` | Volatile |
| `categories` | `Array<Object>` | `[]` (fetched from API) | Volatile |
| `selectedCategory` | `string` | `''` | Volatile |

### 4.4 Component Details

#### `InputTab` — Primary Logging Interface

**Props:** `msg`, `setMsg`, `send`, `loading`, `loadingLabel`, `selectedFile`, `setSelectedFile`, `imagePreview`, `setImagePreview`, `categories`, `selectedCategory`, `setSelectedCategory`

**UI Elements:**
1. **Category Selector** — `<select>` dropdown populated from `categories` array (shows `name` as label, `name` as value).
2. **Message Textarea** — 3-row textarea with a clear button (❌) overlay.
3. **Attach Image** — File picker (`<input type="file" accept="image/*">`) with styled label. Shows selected filename.
4. **Image Preview** — Thumbnail (`max 150×150px`) with a remove button (red circle ✕). Only shown when `imagePreview` is set.
5. **Log Button** — Full-width submit button. Disabled when `loading` OR when both text and image are empty.

**iOS Compatibility:** Uses `onInput` (not `onChange`) for the textarea to prevent keyboard dismissal on iOS devices.

**File Handling:**
- `FileReader.readAsDataURL()` converts the selected file to a base64 data URL for preview AND transmission.
- The base64 string is sent directly to the backend (GAS decodes it and saves to Drive).

#### `CategoriesTab` — CRUD Management

**Props:** `categories`, `fetchCategories`, `createCategory`, `updateCategory`, `loading`

**Internal State:**
- `form` — `{name, value, desc, status}` for the add/edit form.
- `editing` — Currently selected category object (or `null` for create mode).

**UI Elements:**
1. **Add/Edit Form** — Dual-column layout for Name + Value fields. Value field is disabled during edit mode. Description field is full-width. Status selector (Active/Inactive). Submit button toggles between "Add" and "Update" labels.
2. **Categories List** — Scrollable container (`max-h-60`) with divider lines. Each row shows: name, value (in parentheses), status badge (green `Active` / red `Inactive`), description (if any), Edit button, and Toggle button.
3. **Refresh Button** — Manually re-fetches categories from the API.

**API Communication:**
- **GET** `/exec?endpoint=getCategories&chatId=<cid>` — fetches all categories.
- **POST** to the webhook URL with `Content-Type: text/plain` (CORS workaround for GAS). Body contains `endpoint`, `chatId`, and category fields.

#### `SettingsTab` — Configuration

**Props:** `url`, `setUrl`, `cid`, `setCid`, `saveUrl`, `saveCid`, `loading`, `loadingLabel`

**UI Elements:**
1. Webhook URL input field.
2. Chat ID input field.
3. Save button — calls both `saveUrl()` and `saveCid()` which persist to `localStorage`.

**Persistence:** Values are saved to `localStorage` keys `tg_url` and `tg_cid`. Loaded on app initialization.

#### `LogTab` — Debug Console

**Props:** `logs`, `testGPS`, `loading`, `loadingLabel`

**UI Elements:**
1. **Test Location** button — triggers `testGPS()` to verify device geolocation.
2. **Log Console** — Scrollable area (`max-h-64`) displaying timestamped log entries. Color-coded by kind:
   - `error` → red
   - `success` → green
   - `info` → blue
   - default → inherit

### 4.5 Core Functions

#### `send()` — Primary Message Dispatch

```
1. Acquire GPS coordinates (navigator.geolocation.getCurrentPosition)
2. On success:
   ├─ Log GPS coordinates
   ├─ Construct payload with text + GPS + category
   └─ Call post()
3. On GPS failure:
   ├─ Log error + show toast
   └─ Call post() with text + category only (no GPS)
```

The `post()` helper constructs the body object:
```json
{
  "message": {
    "text": "...",
    "chat": { "id": 235221921 },
    "location": { "latitude": 1.37..., "longitude": 103.82... },
    "category": "Journal",
    "photoData": "data:image/jpeg;base64,...",
    "photoName": "IMG_1234.jpg"
  }
}
```

**CORS Handling:** Uses `mode: 'no-cors'` — the request is fire-and-forget. The response cannot be read, so the app logs "Transmission accepted" unconditionally (optimistic update).

#### `fetchCategories()` — Category Fetch

```
GET ${url}${url.includes('?') ? '&' : '?'}endpoint=getCategories&chatId=${cid}
```

Parses JSON response. Expects either an array (success) or `{status: 'error', message: '...'}`.

#### `createCategory()` / `updateCategory()` — Category Mutation

POSTs to the webhook URL with `Content-Type: text/plain` (GAS CORS workaround). Sends JSON body with `endpoint` field for routing.

#### `getCurrentPos()` — GPS Wrapper

Wraps `navigator.geolocation.getCurrentPosition()` in a Promise for `async/await` usage.

### 4.6 Dark Mode

Toggled via the `dark` boolean state. The `useEffect` hook applies/removes the `dark` class on `<html>`. Tailwind's `dark:` variants handle the rest.

### 4.7 Toast Notifications

Auto-dismissing overlay (`3s timeout`). Color: green for success, red for error. Triggered by `addLog()` when `kind` is `'success'` or `'error'`.

---

## 5. API Contract

### 5.1 GET Endpoints

#### `GET /exec?endpoint=getCategories&chatId=<ID>`

**Authorization:** Required (Chat ID check).

**Response (success):** JSON array of category objects.
```json
[
  { "name": "Journal", "value": "journal", "desc": "Personal entries", "status": "Active" },
  { "name": "Work", "value": "work", "desc": "Work-related", "status": "Active" }
]
```

**Response (error):**
```json
{ "status": "error", "message": "Unauthorized request" }
```

### 5.2 POST Endpoints

All POST endpoints send the body as `text/plain` (GAS CORS workaround) but contain JSON. The GAS backend parses it with `JSON.parse()`.

#### POST — Log Message
```json
{
  "message": {
    "text": "Hello world",
    "chat": { "id": 235221921 },
    "category": "Journal",
    "location": { "latitude": 1.3799, "longitude": 103.8278 },
    "photoData": "data:image/jpeg;base64,...",
    "photoName": "IMG_1234.jpg"
  }
}
```
No `endpoint` field needed — defaults to `log`. No authorization required.

**Response:**
```json
{ "status": "success", "photoUrl": "https://drive.google.com/..." }
```

#### POST — Create Category
```json
{ "endpoint": "createCategory", "chatId": "235221921", "name": "Work", "value": "work", "desc": "Work tasks", "status": "Active" }
```

#### POST — Update Category
```json
{ "endpoint": "updateCategory", "chatId": "235221921", "originalValue": "work", "name": "Work", "value": "work", "desc": "Updated", "status": "Active" }
```

#### POST — Delete Category (Soft)
```json
{ "endpoint": "deleteCategory", "chatId": "235221921", "value": "work" }
```

---

## 6. Google Drive Storage Structure

```
{NOTES_FOLDER_PATH}/
├── 2025-07-19.md          ← Daily note file (appended per message)
├── 2025-07-20.md
├── {PHOTOS_SUBFOLDER}/    ← e.g., "photos"
│   ├── PHOTO_abc123.jpg
│   └── IMG_4567.jpg
└── {FILES_SUBFOLDER}/     ← e.g., "files"
    └── xyz789_document.pdf
```

Daily note files use Obsidian-compatible Wikilink syntax: `![[filename]]` for embedded media references.

---

## 7. Telegram Integration

### 7.1 Webhook Flow

```
User sends message/photo to @LoggerBOT on Telegram
    │
    ▼
Telegram Bot API sends POST to GAS webhook URL (WEBAPP_URL)
    │
    ▼
GAS doPost(e) receives Telegram payload format
    │
    ▼
handleLog(data) processes:
  - Extracts text/photo/document from Telegram-native format
  - Downloads media via getFile API → saves to Drive
  - Appends Markdown note to daily file
  - Logs to Messages sheet
  - Sends random thought response back via sendText()
```

### 7.2 WebApp Integration

When the bot sends a message with an `InlineKeyboardButton` containing `web_app: { url: "..." }`, Telegram opens the React SPA as a WebApp. The SPA then POSTs directly to the GAS URL (bypassing Telegram's message pipeline).

---

## 8. Security Model

| Layer | Mechanism | Limitation |
|-------|-----------|------------|
| **Chat ID Authorization** | `AUTHORIZED_CHAT_ID` in BOT sheet compared against incoming `chatId` | Single-user; fail-open if not configured |
| **GAS Deployment** | "Execute as: Me" + "Who has access: Anyone" (required for webhooks) | Public URL — authorization is application-level only |
| **CORS** | `no-cors` mode on frontend POSTs | Fire-and-forget; cannot inspect responses |
| **HTTPS** | GAS provides HTTPS automatically | Frontend must also be served over HTTPS for geolocation |

**Critical:** The GAS Web App URL is effectively public. All security depends on the `AUTHORIZED_CHAT_ID` check in `checkAuthorization()`. If this config is missing, all CRUD endpoints are open.

---

## 9. Known Constraints & Design Decisions

### 9.1 Google Apps Script Limitations

- **No CORS preflight support** — POST requests from the browser must use `Content-Type: text/plain` (or `no-cors` mode) to avoid `OPTIONS` preflight. The backend parses the body as JSON regardless of Content-Type.
- **~30 second execution timeout** — Long-running operations (e.g., large file downloads) may hit this limit.
- **2MB response limit** — ContentService responses are capped at 2MB.
- **200 invocations/day per user** (free tier) — High-volume usage requires a Google Workspace account.

### 9.2 Frontend Constraints

- **Babel Standalone** — In-browser JSX compilation adds ~1-3s initial load. Acceptable for a personal tool; not suitable for production public-facing apps.
- **`no-cors` POST** — Responses are opaque. The app cannot verify if a log message actually succeeded. It assumes success (optimistic update).
- **Geolocation requires HTTPS** — `navigator.geolocation` is blocked in insecure contexts. The app logs `isSecureContext` on startup for debugging.
- **iOS textarea** — Uses `onInput` instead of `onChange` to prevent virtual keyboard dismissal.

### 9.3 Data Model Decisions

- **Soft-delete** — Categories are never actually removed. `deleteCategory` sets `Status = "Inactive"`. The toggle button in the UI reactivates them.
- **UUID-based filenames** — All Drive files use unique IDs to prevent collisions. Original filenames are preserved for documents; photos use `PHOTO_{UUID}.jpg`.
- **Daily Markdown files** — Notes are appended to date-stamped `.md` files in Drive, compatible with Obsidian's `![[link]]` syntax.
- **Value as unique key** — Categories use a lowercase slug (`value` field) as their identifier, not `name`. This is enforced by the `disabled={!!editing}` on the value field during edits.

---

## 10. Deployment Checklist

### 10.1 Google Apps Script Setup

1. Create a new Google Spreadsheet.
2. Add sheets: `BOT`, `Messages`, `Categories`, `Thoughts`, `Debug`.
3. Populate the `BOT` sheet with configuration keys and values.
4. Open **Extensions > Apps Script**.
5. Copy `code.gs` contents (the version committed to repo, not the local `.gitignore`'d copy).
6. Deploy as **Web App**:
   - Execution identity: **Me**
   - Who has access: **Anyone**
7. Copy the deployed URL.
8. In the Spreadsheet, use **Run Scripts > setWebhook** to register the URL with Telegram.

### 10.2 Google Sheet Setup

**BOT sheet** (minimum required rows):
```
BOT_TOKEN        <your_telegram_bot_token>
WEBAPP_URL       https://script.google.com/macros/s/<deploy_id>/exec
NOTES_FOLDER_PATH   Notes
FILES_SUBFOLDER     files
PHOTOS_SUBFOLDER    photos
DEBUG_SHEET         Debug
MESSAGES_SHEET      Messages
AUTHORIZED_CHAT_ID  235221921
```

**Categories sheet** (headers required):
```
Name    Value    Desc    Status
```

**Messages sheet** (headers required):
```
Timestamp    ChatID    Category    Text    PhotoURL    Filename    FileURL    Note    Location    Updated
```

**Thoughts sheet** (headers optional, data from row 2):
```
Random thought 1
Random thought 2
```

### 10.3 Frontend Deployment

The SPA (`index.html` + `app.js`) can be served from:
- A local web server (`python3 -m http.server`) for development
- Any static file hosting (GitHub Pages, Netlify, etc.)
- Telegram WebApp URL (configured in the bot's InlineKeyboardButton)

### 10.4 API Testing

Open `test_api.html` in a browser, set `{{WEBHOOK_URL}}` and `{{CHAT_ID}}` placeholders, and test each CRUD endpoint independently.

---

## 11. Error Handling Matrix

| Failure Point | Detection | Recovery |
|--------------|-----------|----------|
| GPS unavailable | `getCurrentPos()` rejection | Fallback to text-only send |
| Network offline | `fetch()` rejection | Logged as error; no retry |
| GAS timeout | Connection reset | Logged as network error |
| Unauthorized request | `{status: "error", message: "Unauthorized"}` | User must correct Chat ID in Settings |
| Missing sheet | `"sheet not found"` error | Admin must create the sheet |
| Duplicate category value | `"already exists"` error | User chooses a unique value |
| Base64 decode failure | `showDebug()` on GAS | Photo skipped; text still logged |

---

## 12. Testing Utilities

### `test_api.html`
Standalone HTML page for testing all CRUD endpoints. Features:
- Configuration section (Webhook URL + Chat ID).
- GET Categories button.
- CREATE Category form (Name, Value, Description, Status).
- UPDATE Category form (Original Value + all editable fields).
- DELETE Category input (Value to deactivate).
- Response console with color-coded output (green success, red errors).
- Handles GAS CORS workaround (`text/plain` for POST, `GET` for read).

### `message.json`
Example payload matching the structured message schema expected by `handleLog()`:
```json
{
  "message": {
    "category": "Journal",
    "text": "Hello",
    "chat": { "id": 235221921 },
    "location": {
      "latitude": 1.3799005393908135,
      "longitude": 103.82781949913434
    }
  }
}
```

---

## 13. Development Notes

### Git Strategy
- `code.gs` is `.gitignore`'d because it contains environment-specific configuration. A clean copy exists in `ARCHIVE/code.gs` for reference.
- Plan documents (`categories_crud_plan.md`, `picture_upload_plan.md`) are also ignored.

### Code Quality Observations
- The archive version (`ARCHIVE/code.gs`) shows a previous `handleLog` implementation that extracted `category` differently and mapped `strLocation` to the Messages sheet. The current `code.gs` reads `category` from `data.message.category` and writes `location` as a formatted string.
- `app.js` has a duplicated comment on line 561-562 (`// Send message with optional GPS location and optional image` appears twice).
- The `test_api.html` template uses `{{WEBHOOK_URL}}` and `{{CHAT_ID}}` placeholders that must be replaced before use.
