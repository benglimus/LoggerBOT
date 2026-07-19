# Implementation Plan: In-App Camera Capture

## Goal Description

Add a camera icon button in the Input tab that invokes the iPhone camera directly (via HTML `capture="environment"`), captures a photo, previews it, and uploads it to Google Drive through the existing photo pipeline — saving the Drive URL and logging the message row in Google Sheets just like the current file-picker upload does.

**Why:** Eliminates the friction of opening the Photos app → selecting a photo → returning to the web app. One tap → camera → preview → log.

---

## User Review Required

> [!IMPORTANT]
> **No backend changes required.** The existing `handleLog()` already handles `data.message.photoData` (base64) from the Web App (lines 371–393 in `code.gs`). The camera capture flows through the exact same path as the file picker — both produce a base64 `imagePreview` that gets sent as `photoData`.

> [!NOTE]
> **iOS requirement**: `capture="environment"` triggers the camera directly. On desktop browsers, it falls back to a normal file picker. This is standard HTML5 behavior — no special permissions or APIs needed.

---

## Open Questions

> [!CAUTION]
> 1. **Front camera or back camera?** The plan below uses `capture="environment"` (rear camera). Should we also support `capture="user"` (front/selfie)? Or let the user choose?
> 2. **Image size concern:** iPhones capture high-resolution photos (12–48 MP). Encoding a full-resolution photo as base64 and POSTing it via `fetch` to Google Apps Script could hit the 50 MB POST limit (~37.5 MB base64). Do you want client-side compression/resize before sending?
> 3. **Single photo or photo + text?** Current flow allows photo + caption. Should the quick-camera flow auto-send without requiring text, or still require the user to tap Log?

---

## Current Architecture Reference

### Client-side photo flow (`app.js`)

```
InputTab: <input type="file" accept="image/*"> (line 73)
  → handleFileChange: reads file as DataURL via FileReader
  → sets imagePreview (base64 string) + selectedFile (File object)

App.send() (line 562):
  → reads imagePreview → photoData (base64)
  → reads selectedFile.name → photoName
  → calls post(target, chatId, text, photoData, photoName, metadata)

post() (line 607):
  → sends JSON: { message: { text, photoData, photoName, chat: { id }, ... } }

Success callback (line 641):
  → clears selectedFile, imagePreview, selectedCategory
```

### Backend photo flow (`code.gs` handleLog, lines 371–393)

```
if (data.message.photoData):
  → split base64, decode with Utilities.base64Decode()
  → create blob, save to Drive via saveBlobToDrive()
  → set strPhotoUrl = getDriveFileUrl(driveFileId)
  → append to daily markdown note
  → log row in Messages sheet
```

The camera capture produces the **exact same `photoData` (base64)** that the backend expects. No backend changes needed.

---

## Proposed Changes

### [MODIFY] `index.html` — Add a hidden camera input

Add a second file input alongside the existing one, but with `capture="environment"` to trigger the camera:

```html
<!-- In app.js InputTab JSX, add alongside the existing file input -->
```

### [MODIFY] `app.js` — InputTab: Add camera button and hidden capture input

#### 1. Add new state/props to InputTab

Pass through the existing `selectedFile`/`imagePreview` state (no new state needed — camera reuses the same preview pipeline). Add a new `onCapture` handler that triggers the hidden camera input.

```jsx
// In InputTab component, add after the existing file picker block:

{/* Camera Capture Button */}
<button
  type="button"
  className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200
    dark:bg-gray-700 dark:hover:bg-gray-600 rounded border dark:border-gray-600
    transition text-sm font-medium"
  onClick={() => cameraInputRef.current?.click()}
>
  {/* Camera SVG icon */}
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89A4 4 0 0110.89 5.5
        H13a4 4 0 014 4v.5h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
    <circle cx="12" cy="13" r="2" />
  </svg>
  <span>📷 Take Photo</span>
</button>

{/* Hidden camera capture input */}
<input
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  ref={cameraInputRef}
  onChange={handleCameraCapture}
/>
```

#### 2. Add `handleCameraCapture` handler

This mirrors `handleFileChange` but specifically for camera capture:

```jsx
const cameraInputRef = React.useRef(null);

const handleCameraCapture = (e) => {
  const file = e.target.files[0];
  if (file) {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result); // base64 DataURL
    };
    reader.readAsDataURL(file);
  }
  // Reset the input so the same photo can trigger onChange again
  e.target.value = '';
};
```

#### 3. Update InputTab props

Add `cameraInputRef` handling — since refs can't be passed as props cleanly, lift the ref to `App` and pass a `triggerCamera` callback:

```jsx
// In App component:
const cameraInputRef = useRef(null);

const triggerCamera = () => {
  cameraInputRef.current?.click();
};

// Handle camera capture (same as file picker)
const handleCameraCapture = () => {
  // Triggered via a hidden input in App, not in InputTab
  // Actually, simpler: just place the hidden input inside App's JSX
};
```

**Revised approach** — keep it simple by embedding the hidden camera input directly in `App` and passing a click handler:

```jsx
// In App component (after line 370):
const cameraRef = useRef(null);

// Pass to InputTab as a new prop
const takePhoto = () => cameraRef.current?.click();
```

```jsx
// In App JSX (hidden, renders outside the tab area):
<input
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  ref={cameraRef}
  onChange={(e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }}
/>
```

#### 4. Add camera button in InputTab UI

Add the camera button alongside the existing "Choose Image" button:

```jsx
// Inside InputTab JSX, in the "Attach Image" section (after line 85):
<div className="flex items-center space-x-2">
  {/* Existing file picker */}
  <label className="cursor-pointer ...">
    <span>📁 Choose from Photos</span>
    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
  </label>

  {/* NEW: Camera capture button */}
  <button
    type="button"
    className="cursor-pointer bg-indigo-100 hover:bg-indigo-200
      dark:bg-indigo-900/50 dark:hover:bg-indigo-800/50
      text-indigo-700 dark:text-indigo-300
      text-sm font-medium py-2 px-4 rounded border
      border-indigo-300 dark:border-indigo-700
      transition flex items-center space-x-1"
    onClick={takePhoto}
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89A4 4 0 0110.89 5.5
          H13a4 4 0 014 4v.5h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
      <circle cx="12" cy="13" r="2" />
    </svg>
    <span>Camera</span>
  </button>
</div>
```

### Summary of app.js changes

| Location | Change |
|----------|--------|
| `App()` component | Add `cameraRef = useRef(null)` |
| `App()` component | Add `takePhoto = () => cameraRef.current?.click()` |
| `App()` JSX | Add hidden `<input type="file" capture="environment">` with ref + `onChange` handler |
| `InputTab` props | Add `takePhoto` callback prop |
| `InputTab` JSX | Add "Camera" button that calls `takePhoto()` |
| `InputTab` label | Rename existing button text from "📷 Choose Image" to "📁 Choose from Photos" (to distinguish from camera) |

### No changes to `code.gs` or `index.html`

The entire flow reuses the existing `imagePreview` → `photoData` → `saveBlobToDrive()` → `AppendToFile()` → `Messages sheet` pipeline.

---

## Optional Enhancement: Client-side photo compression

If Q2 above resolves in favor of compression, add a `compressImage()` step before setting `imagePreview`:

```js
function compressImage(file, maxWidth = 1920, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
```

This reduces a 12 MP iPhone photo (~6 MB → ~300 KB) before base64 encoding, dramatically reducing the POST payload and avoiding GAS limits.

---

## Verification Plan

### 1. Camera button appears
- Open the Web App on iPhone (Safari).
- Navigate to Input tab.
- **Expected**: Two buttons visible — "Choose from Photos" (existing) and "Camera" (new).

### 2. Camera launches on tap
- Tap the "Camera" button.
- **Expected**: iOS camera app opens directly (no Photos picker).

### 3. Photo captured and previewed
- Take a photo in the camera.
- **Expected**: Return to the Web App. The preview thumbnail appears (same as file picker preview). The existing clear button works.

### 4. Photo sent and saved
- Enter optional text, tap **Log**.
- **Expected**:
  - ✅ Photo saved to Drive (Photos subfolder).
  - ✅ Markdown note appended to daily `.md` file with photo reference.
  - ✅ Row added to Messages sheet with photo URL.
  - ✅ Preview cleared after successful send.
  - ✅ Optional: Telegram notification sent (respecting `ENABLE_NOTIFICATIONS` toggle).

### 5. Desktop fallback
- Open the Web App on a desktop browser.
- Tap "Camera" button.
- **Expected**: Falls back to a normal file picker (desktops have no camera). `capture` attribute is ignored by desktop browsers.

### 6. Existing file picker unchanged
- "Choose from Photos" button still works exactly as before.
- Sending without any photo (text-only) works as before.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| iPhone camera captures very large photos → GAS POST limit (50 MB) | Medium | Optional compression step (see Q2). iPhone 15 Pro: 48 MP raw → ~25 MB JPEG → ~33 MB base64. Close to the limit. |
| `capture="environment"` not supported on iOS Safari | Low | Standard HTML5 attribute, supported since iOS 14.3 (2021). Falls back to file picker gracefully. |
| Camera re-opens on button re-tap without new capture | Low | Hidden input value is cleared (`e.target.value = ''`) after each capture. |
| `readAsDataURL` on large photo freezes UI | Low | FileReader runs async. 300 KB–2 MB base64 parses in <100ms. |
| User taps Camera but wants to cancel | Low | iOS camera shows a "Cancel" / "Use Photo" flow — standard behavior. |

**Rollback:** Remove the camera button JSX, `cameraRef`, `takePhoto`, and hidden input. Single-function undo in `app.js`.
