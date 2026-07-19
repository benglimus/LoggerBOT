//LoggerBOT
const strBotToken = getConfig("BOT_TOKEN")
const webAppUrl = getConfig("WEBAPP_URL")
const NOTES_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")
const FILES_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")+"/"+getConfig("FILES_SUBFOLDER")
const PHOTOS_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")+"/"+getConfig("PHOTOS_SUBFOLDER")
const DEBUG_SHEET = getConfig("DEBUG_SHEET")
const MESSAGES_SHEET = getConfig("MESSAGES_SHEET")
const CATEGORIES_SHEET = "Categories"
const THOUGHTS_SHEET = "Thoughts"

function showDebug(strMessage) {
  SpreadsheetApp.getActive()
    .getSheetByName(DEBUG_SHEET)
    .getRange(2, 1)
    .setValue(strMessage)
}

// Append a timestamped debug line to the DEBUG_SHEET (next empty row, column 1)
function debugLog(strMessage) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(DEBUG_SHEET);
    if (!sheet) return; // sheet missing, fail silently
    sheet.appendRow([new Date(), strMessage]);
  } catch (err) {
    // logging itself must not break the handler
  }
}

// Clear the debug sheet (keeps header row, clears rows 2+)
function clearDebug() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(DEBUG_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn() || 1).clear();
  } catch (err) {}
}

function TEST_getRandomThought() {
  console.log(getRandomThought())
}

// Test verifyPassword with simulated GET and POST requests
// Run from Scripts editor → Results show in Execution transcript + debug sheet
function TEST_verifyPassword() {
  // Clear old logs
  clearDebug();

  // Helper: compute SHA-256 hex string for a plaintext password
  function sha256hex(text) {
    const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Read the actual stored PWD from Config sheet
  const configSheet = SpreadsheetApp.getActive().getSheetByName('Config');
  let expectedPw = null;
  if (configSheet) {
    const vals = configSheet.getDataRange().getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === 'PWD') {
        expectedPw = String(vals[i][1]);
        break;
      }
    }
  }

  const correctHash = expectedPw ? sha256hex(expectedPw) : null;
  let passed = 0, failed = 0;

  function assert(testName, actual, expected) {
    const ok = actual === expected;
    if (ok) { passed++; } else { failed++; }
    const status = ok ? 'PASS' : 'FAIL';
    const msg = `[${status}] ${testName} — expected=${expected}, got=${actual}`;
    console.log(msg);
    debugLog(msg);
  }

  debugLog('=== TEST_verifyPassword START ===');
  console.log('Config sheet: ' + (configSheet ? 'found' : 'MISSING'));
  console.log('Stored PWD:   ' + (expectedPw || 'NOT SET'));
  console.log('Correct hash: ' + (correctHash || 'N/A'));
  debugLog('Config sheet: ' + (configSheet ? 'found' : 'MISSING'));
  debugLog('Stored PWD:   ' + (expectedPw || 'NOT SET'));

  // ── Test 1: GET request with correct password hash ──
  debugLog('── Test 1: GET correct hash ──');
  const getEvt = { parameter: { pwHash: correctHash } };
  assert('GET correct hash', verifyPassword(getEvt, null), true);

  // ── Test 2: POST request with correct password hash ──
  debugLog('── Test 2: POST correct hash ──');
  const postBody = { passwordHash: correctHash };
  assert('POST correct hash', verifyPassword(null, postBody), true);

  // ── Test 3: GET request with wrong password hash ──
  debugLog('── Test 3: GET wrong hash ──');
  const wrongHash = sha256hex('WRONG_PASSWORD');
  const getWrongEvt = { parameter: { pwHash: wrongHash } };
  assert('GET wrong hash', verifyPassword(getWrongEvt, null), false);

  // ── Test 4: POST request with wrong password hash ──
  debugLog('── Test 4: POST wrong hash ──');
  const postWrong = { passwordHash: wrongHash };
  assert('POST wrong hash', verifyPassword(null, postWrong), false);

  // ── Test 5: GET request with no password hash ──
  debugLog('── Test 5: GET no hash ──');
  assert('GET missing hash', verifyPassword({ parameter: {} }, null), false);

  // ── Test 6: POST request with no password hash ──
  debugLog('── Test 6: POST no hash ──');
  assert('POST missing hash', verifyPassword(null, {}), false);

  // ── Test 7: GET request with empty event ──
  debugLog('── Test 7: GET null event ──');
  assert('GET null event', verifyPassword(null, null), false);

  // ── Test 8: POST with Telegram webhook-like payload (no hash) ──
  debugLog('── Test 8: POST Telegram webhook payload ──');
  const tgPayload = { message: { from: { id: 123 }, chat: { id: 123 } } };
  assert('POST Telegram webhook (no hash)', verifyPassword(null, tgPayload), false);

  // ── Summary ──
  const total = passed + failed;
  const summary = `${passed}/${total} tests passed (${failed} failed)`;
  console.log('');
  console.log('====================');
  console.log(`RESULT: ${summary}`);
  console.log('====================');
  debugLog('');
  debugLog(`=== RESULT: ${summary} ===`);

  return summary;
}

function getRandomThought() {
    const sheet = SpreadsheetApp.getActive().getSheetByName(THOUGHTS_SHEET)
    const lastRow = sheet.getLastRow()
    const thoughts = sheet.getRange('A2:A' + lastRow).getValues()
    const rnd = Math.floor((Math.random()*thoughts.length))
    console.log("last row", lastRow,rnd)
    return (thoughts[rnd]+"")
}

// Updated again
function onOpen() {
  var ui = SpreadsheetApp.getUi()
  ui.createMenu("Run Scripts")
    .addItem("getMe", "MENU_getMe")
    .addItem("setWebhook", "MENU_setWebhook")
    .addItem("removeWebhook", "MENU_removeWebhook")
    .addToUi()
}
function MENU_getMe() {
  showAlert(getMe())
}
function MENU_setWebhook() {
  showAlert(setWebhook())
}

function MENU_removeWebhook() {
  showAlert(removeWebhook())
}

function getConfig(item) {
  const ConfigItems = SpreadsheetApp.getActive()
    .getSheetByName("BOT")
    .getDataRange()
    .getValues()
  let result = ""
  for (let i = 0, len = ConfigItems.length; i < len; i++) {
    if (ConfigItems[i][0] === item) {
      result = ConfigItems[i][1]
      break
    }
  }
  return result
}

// Helper to construct JSON response output
function createJsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON)
}

function getMe() {
  let response = UrlFetchApp.fetch(
    `http://api.telegram.org/bot${strBotToken}/getMe`
  )
  console.log(response.getContentText())
  return JSON.parse(response.getContentText())
}

function setWebhook() {
  let response = UrlFetchApp.fetch(
    `http://api.telegram.org/bot${strBotToken}/setWebhook?url=${webAppUrl}`
  )
  console.log(response.getContentText())
  return response.getContentText()
}

function removeWebhook() {
  let response = UrlFetchApp.fetch(
    `http://api.telegram.org/bot${strBotToken}/setWebhook`
  )
  console.log(response.getContentText())
  return response.getContentText()
}

function sendText(strBotToken, chat_id, text) {
  let data = {
    method: "post",
    payload: {
      method: "sendMessage",
      chat_id: String(chat_id),
      text: text,
      parse_mode: "HTML",
    },
  }
  UrlFetchApp.fetch(`https://api.telegram.org/bot${strBotToken}/`, data)
}

const TOKEN = strBotToken
const BASE_URL = "https://api.telegram.org/bot" + TOKEN + "/"

function doGet(e) {
  const endpoint = (e && e.parameter && e.parameter.endpoint);

  if (endpoint === "getCategories") {
    if (!checkAuthorization(e, null) || !verifyPassword(e, null)) {
      return createJsonResponse({ status: "error", message: "Unauthorized request" });
    }
    return handleGetCategories();
  }

  const cachedName = PropertiesService.getScriptProperties().getProperty('BOT_NAME');
  const name = cachedName || 'LoggerBOT';
  if (!cachedName) {
    try {
      const meResult = getMe().result;
      if (meResult.first_name) {
        PropertiesService.getScriptProperties().setProperty('BOT_NAME', meResult.first_name);
      }
    } catch (e) {
      // fallback to default name
    }
  }
  const output = `Hello, my name is ${name}`
  return ContentService.createTextOutput(output)
}

function doPost(e) {
  let data = {};
  try {
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    showDebug("JSON Parse Error: " + err.toString());
  }

  // Route by query param (?endpoint=...) OR body param (data.endpoint) OR default to "log"
  const endpoint = (e && e.parameter && e.parameter.endpoint) || data.endpoint || "log";

  switch (endpoint) {
    case "log":
      // Telegram webhooks have data.message.from — bypass password check
      const isTelegramWebhook = data.message && data.message.from;
      if (!isTelegramWebhook) {
        if (!verifyPassword(e, data)) {
          return createJsonResponse({ status: "error", message: "Unauthorized: invalid or missing password" });
        }
      }
      return handleLog(data);
    case "getCategories":
      if (!checkAuthorization(e, data) || !verifyPassword(e, data)) {
        return createJsonResponse({ status: "error", message: "Unauthorized request" });
      }
      return handleGetCategories();
    case "createCategory":
      if (!checkAuthorization(e, data) || !verifyPassword(e, data)) {
        return createJsonResponse({ status: "error", message: "Unauthorized request" });
      }
      return handleCreateCategory(data);
    case "updateCategory":
      if (!checkAuthorization(e, data) || !verifyPassword(e, data)) {
        return createJsonResponse({ status: "error", message: "Unauthorized request" });
      }
      return handleUpdateCategory(data);
    case "deleteCategory":
      if (!checkAuthorization(e, data) || !verifyPassword(e, data)) {
        return createJsonResponse({ status: "error", message: "Unauthorized request" });
      }
      return handleDeleteCategory(data);
    default:
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Unknown endpoint: " + endpoint
      })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Authorization check helper
function checkAuthorization(e, data) {
  const authorizedId = getConfig("AUTHORIZED_CHAT_ID");
  if (!authorizedId) {
    // If not configured in BOT sheet, allow access to prevent locking out
    return true;
  }

  const incomingChatId = (e && e.parameter && e.parameter.chatId) ||
                         (data && data.chatId) ||
                         (data && data.message && data.message.chat && data.message.chat.id);

  return String(incomingChatId) === String(authorizedId);
}

// Password-based authentication for web app requests
// GET: reads pwHash from query params, POST: reads passwordHash from body
// Config sheet stores plaintext password — we hash it server-side for comparison
function verifyPassword(e, data) {
  const timestamp = new Date().toISOString();
  const requestSource = (e && e.parameter && e.parameter.pwHash) ? "GET" : "POST";
  debugLog(`[verifyPassword] START (${timestamp}) source=${requestSource}`);

  const pwHash = (e && e.parameter && e.parameter.pwHash) ||
                 (data && data.passwordHash);
  debugLog(`[verifyPassword] pwHash received: ${pwHash ? pwHash.substring(0, 10) + '...' : 'NULL'} (source=${requestSource})`);
  if (!pwHash) return false;
  debugLog('[verifyPassword] FAIL — pwHash is missing/empty');

  // Read stored plaintext password from Config sheet
  const sheet = SpreadsheetApp.getActive().getSheetByName('Config');
  debugLog(`[verifyPassword] Config sheet found: ${sheet ? 'YES' : 'NO'}`);
  if (!sheet) return false;
  debugLog('[verifyPassword] FAIL — Config sheet not found');
  const values = sheet.getDataRange().getValues();
  debugLog(`[verifyPassword] Config sheet total rows: ${values.length}`);
  let storedPw = null;
  for (let i = 0; i < values.length; i++) {
    debugLog(`[verifyPassword] row[${i}] key="${String(values[i][0])}", value="${String(values[i][1] || '')}"`);
    if (String(values[i][0]) === 'PWD') {
      storedPw = String(values[i][1]);
      break;
    }
  }
  debugLog(`[verifyPassword] storedPw resolved: ${storedPw ? 'FOUND (' + storedPw.length + ' chars)' : 'NULL'}`);

  if (!storedPw) return false;
  debugLog('[verifyPassword] FAIL — PWD not found in Config');

  // Hash the stored plaintext password (SHA-256) and compare
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, storedPw);
  const serverHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  debugLog(`[verifyPassword] serverHash computed: ${serverHash.substring(0, 16)}... (length=${serverHash.length})`);
  const matches = pwHash === serverHash;
  debugLog(`[verifyPassword] pwHash === serverHash ? ${matches} (received="${pwHash.substring(0, 16)}...", computed="${serverHash.substring(0, 16)}...")`);
  return matches;
}

// READ: Get all categories
function handleGetCategories() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CATEGORIES_SHEET);
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Categories sheet not found" });
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    const categories = [];
    for (let i = 1; i < values.length; i++) {
      categories.push({
        name: values[i][0],
        value: values[i][1],
        desc: values[i][2],
        status: values[i][3]
      });
    }
    
    return createJsonResponse(categories);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// CREATE: Add new category
function handleCreateCategory(data) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CATEGORIES_SHEET);
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Categories sheet not found" });
    }
    
    const name = data.name || "";
    const val = data.value || "";
    const desc = data.desc || "";
    const status = data.status || "Active";
    
    if (!name || !val) {
      return createJsonResponse({ status: "error", message: "Name and Value are required fields" });
    }
    
    // Check if category already exists
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === val) {
        return createJsonResponse({ status: "error", message: "Category with value '" + val + "' already exists" });
      }
    }
    
    sheet.appendRow([name, val, desc, status]);
    return createJsonResponse({ status: "success", message: "Category created" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// UPDATE: Modify category by original value
function handleUpdateCategory(data) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CATEGORIES_SHEET);
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Categories sheet not found" });
    }
    
    const originalValue = data.originalValue || data.value;
    const name = data.name;
    const val = data.value;
    const desc = data.desc;
    const status = data.status;
    
    if (!originalValue) {
      return createJsonResponse({ status: "error", message: "originalValue or value identifier is required" });
    }
    
    const values = sheet.getDataRange().getValues();
    let rowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === originalValue) {
        rowIdx = i + 1; // 1-indexed row index
        break;
      }
    }
    
    if (rowIdx === -1) {
      return createJsonResponse({ status: "error", message: "Category not found" });
    }
    
    // Update fields if provided
    if (name !== undefined) sheet.getRange(rowIdx, 1).setValue(name);
    if (val !== undefined) sheet.getRange(rowIdx, 2).setValue(val);
    if (desc !== undefined) sheet.getRange(rowIdx, 3).setValue(desc);
    if (status !== undefined) sheet.getRange(rowIdx, 4).setValue(status);
    
    return createJsonResponse({ status: "success", message: "Category updated" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// DELETE (SOFT): Set category status to Inactive
function handleDeleteCategory(data) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CATEGORIES_SHEET);
    if (!sheet) {
      return createJsonResponse({ status: "error", message: "Categories sheet not found" });
    }
    
    const val = data.value;
    if (!val) {
      return createJsonResponse({ status: "error", message: "Value parameter is required to delete" });
    }
    
    const values = sheet.getDataRange().getValues();
    let rowIdx = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === val) {
        rowIdx = i + 1;
        break;
      }
    }
    
    if (rowIdx === -1) {
      return createJsonResponse({ status: "error", message: "Category not found" });
    }
    
    sheet.getRange(rowIdx, 4).setValue("Inactive");
    return createJsonResponse({ status: "success", message: "Category deactivated" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function handleLog(data) {
  let strTextReceived = (data.message && data.message.text) ? data.message.text : "";
  const chatId = (data.message && data.message.chat) ? data.message.chat.id : "";
  const sheet = SpreadsheetApp.getActive().getSheetByName(MESSAGES_SHEET)

  let strPhotoUrl = ""
  let strFilename = ""
  let strFileUrl = ""
  let strNote = ""
  let blnNoteUpdated = false
  let pictureFound, fileFound, youtubeFound

  // Strip photoData before debug logging — base64 image data exceeds Sheets' 50K cell limit
  let debugData = data;
  if (data && data.message && data.message.photoData) {
    debugData = JSON.parse(JSON.stringify(data));
    debugData.message.photoData = '[base64 image data omitted — ' + data.message.photoData.length + ' chars]';
  }
  showDebug(JSON.stringify(debugData, null, 5))

  // 1. Extract Metadata from structured payload (New Format)
  // This handles: message.category, message.location, etc.
  let category = (data.message && data.message.category) ? data.message.category : "";
  // if (category) {
  //   strTextReceived = (category ? `[${category}] ` : "") + strTextReceived;
  // }

  let locationObj = null;
  if (data.message && data.message.location) {
    locationObj = data.message.location;
    // Create a descriptive text for the log if location is present
    const locLink = `https://maps.google.com/?q=${locationObj.latitude},${locationObj.longitude}`;
    // strTextReceived += `\n\n📍 Location: ${locLink}`;
  }

  // 2. Handle Media (existing logic)
  // Check if the message contains a photo (from Telegram)
  if (data.message && data.message.photo) {
    const fileId = data.message.photo[data.message.photo.length - 1].file_id
    const file = getTelegramFile(fileId)

    strFilename = "PHOTO_"+UniqueID()+".jpg"
    const driveFileId = saveFileToDrive(
      strBotToken,
      chatId,
      PHOTOS_FOLDER_PATH,
      file,
      strFilename
    )

    const driveFileUrl = getDriveFileUrl(driveFileId)
    strPhotoUrl = driveFileUrl
    if (data.message.caption) {
      strTextReceived = data.message.caption
    } else {
      strTextReceived = "PHOTO: " + TimeStamp()
    }
    pictureFound = true
  }
  // Check if the message contains a direct base64 uploaded photo (from Web App)
  else if (data.message && data.message.photoData) {
    try {
      const parts = data.message.photoData.split(",");
      const contentType = parts[0].match(/:(.*?);/)[1];
      const base64Data = parts[1];
      const decoded = Utilities.base64Decode(base64Data);
      
      strFilename = data.message.photoName || ("PHOTO_" + UniqueID() + ".jpg");
      const fileBlob = Utilities.newBlob(decoded, contentType, strFilename);
      
      const driveFileId = saveBlobToDrive(PHOTOS_FOLDER_PATH, fileBlob, strFilename);
      strPhotoUrl = getDriveFileUrl(driveFileId);
      
      if (data.message.text) {
        strTextReceived = data.message.text;
      } else {
        strTextReceived = "PHOTO: " + TimeStamp();
      }
      pictureFound = true;
    } catch (err) {
      showDebug("Error saving direct photo: " + err.toString());
    }
  }

  // Check if the message contains an attached file
  if (data.message && data.message.document) {
    const fileId = data.message.document.file_id
    const file = getTelegramFile(fileId)
    strFilename = data.message.document.file_name
    strFilename = UniqueID()+"_"+strFilename

    const driveFileId = saveFileToDrive(
      strBotToken,
      chatId,
      FILES_FOLDER_PATH,
      file,
      strFilename
    )

    const driveFileUrl = getDriveFileUrl(driveFileId)
    strFileUrl = driveFileUrl
    if (data.message.caption) {
      strTextReceived = data.message.caption
    } else {
      strTextReceived = "FILE: " + strFilename
    }
    fileFound = true
  }

  const strDailyFilename = `${DateStamp()}.md`

  if (strFileUrl) {
    strNote = `\n${strTextReceived} ![[${strFilename}]]`
  } else if (strPhotoUrl) {
    strNote = `\n${strTextReceived} ![[${strFilename}]]`
  } else {
    const formatted = formatNote(strTextReceived)
    strNote = formatted.text
  }
  blnNoteUpdated = AppendToFile(NOTES_FOLDER_PATH, strDailyFilename, strNote)
  
  const notificationsEnabled = getConfig("ENABLE_NOTIFICATIONS")
  if (notificationsEnabled && !["false", "no", "0", "off"].includes(String(notificationsEnabled).toLowerCase())) {
    let randomThought = getRandomThought()
    if (randomThought) {
      sendText(strBotToken, chatId, randomThought)
    } else {
      sendText(strBotToken, chatId, `Message received: ${TimeStamp()}`)
    }
  }

  SpreadsheetApp.getActive()
    .getSheetByName(MESSAGES_SHEET)
    .appendRow([
      TimeStamp(),
      chatId,
      category,
      strTextReceived,
      strPhotoUrl,
      strFilename,
      strFileUrl,
      strNote,
      locationObj ? `${locationObj.latitude},${locationObj.longitude}` : "",
      blnNoteUpdated
    ]);

  return createJsonResponse({
    status: "success",
    photoUrl: strPhotoUrl
  });
}

function saveBlobToDrive(folderPath, blob, filename) {
  try {
    if (folderPath === "" || folderPath === "/") {
      folderPath = ""
    } else {
      folderPath = folderPath.replace(/^\/|\/$/g, "")
    }
    const targetFolder = findOrCreateFolderByPath(folderPath)
    const driveFile = targetFolder.createFile(blob)
    driveFile.setName(filename)
    return driveFile.getId()
  } catch (e) {
    Logger.log("Error in saveBlobToDrive: " + e.toString())
    return null;
  }
}

function formatNote(strText) {
  let youtubeFound = false
  const astrLines = strText.split("\n")
  let newText = ""
  astrLines.forEach(line => {
    if (line.startsWith("https://youtu.be") || (line.startsWith("https://www.youtube"))) {
      youtubeFound = true
      let strCaption = getVideoTitleFromYouTubeURL(line)
      if (strCaption) {
        newText += `![${strCaption}](${line})` + "\n"
      } else {
        newText += line + "\n"
      }
    } else {
        newText += line + "\n"
    }
  });
  return {text: newText, youtube: youtubeFound}
}

function generateNote(
  strTextReceived,
  strTextExisting,
  strPhotoUrl,
  strFilename,
  strFileUrl
) {
  const strNewText = strTextReceived.trim()
  const strOldText = strTextExisting.trim()
  let strTags = ""
  let strBody = ""

  let arrNew = []
  let arrOld = []

  if (strNewText.startsWith("#")) {
    arrNew = extractHashtags(strNewText)
    strTextReceived = findAndReturnAfterNewline(strNewText)
  }

  if (strOldText.startsWith("#")) {
    arrOld = extractHashtags(strOldText)
    strTextExisting = findAndReturnAfterNewline(strOldText)
  }

  const mergedTags = mergeAndSortArrays(arrOld, arrNew)
  strTags = mergedTags.join(" ").trim() + "\n"

  strBody = strTextExisting + "\n" + strTextReceived

  return strTags + strBody
}

function getTelegramFile(fileId) {
  const response = UrlFetchApp.fetch(BASE_URL + "getFile?file_id=" + fileId)
  return JSON.parse(response.getContentText())
}

function saveFileToDrive(botToken, chatId, folderPath, telegramFile,filename=(chatId + "_" + UniqueID())) {
  try {
    const fileUrl =
      "https://api.telegram.org/file/bot" +
      botToken +
      "/" +
      telegramFile.result.file_path
    const response = UrlFetchApp.fetch(fileUrl)
    const fileBlob = response.getBlob()

    if (folderPath === "" || folderPath === "/") {
      folderPath = ""
    } else {
      folderPath = folderPath.replace(/^\/|\/$/g, "")
    }

    const targetFolder = findOrCreateFolderByPath(folderPath)

    const driveFile = targetFolder.createFile(fileBlob)
    driveFile.setName(filename)
    return driveFile.getId()
  } catch (e) {
    Logger.log("Error: " + e.toString())
    return null
  }
}
