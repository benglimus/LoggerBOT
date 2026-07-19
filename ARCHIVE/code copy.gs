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

function TEST_getRandomThought() {
  console.log(getRandomThought())
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
    if (!checkAuthorization(e, null)) {
      return createJsonResponse({ status: "error", message: "Unauthorized request" });
    }
    return handleGetCategories();
  }

  const name = getMe().result.first_name
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

  // Check authorization for custom endpoint requests
  if (endpoint !== "log") {
    if (!checkAuthorization(e, data)) {
      return createJsonResponse({ status: "error", message: "Unauthorized request" });
    }
  }

  switch (endpoint) {
    case "log":
      return handleLog(data);
    case "getCategories":
      return handleGetCategories();
    case "createCategory":
      return handleCreateCategory(data);
    case "updateCategory":
      return handleUpdateCategory(data);
    case "deleteCategory":
      return handleDeleteCategory(data); // Will perform soft-delete
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

  showDebug(JSON.stringify(data, null, 5))

  // 1. Extract Metadata from structured payload (New Format)
  // This handles: message.category, message.location, etc.
  let category = (data.message && data.message.category) ? data.message.category : "";
  if (category) {
    strTextReceived = (category ? `[${category}] ` : "") + strTextReceived;
  }

  let locationObj = null;
  if (data.message && data.message.location) {
    locationObj = data.message.location;
    // Create a descriptive text for the log if location is present
    const locLink = `https://maps.google.com/?q=${locationObj.latitude},${locationObj.longitude}`;
    strTextReceived += `\n\n📍 Location: ${locLink}`;
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
  
  let randomThought = getRandomThought()
  if (randomThought) {
    sendText(strBotToken, chatId, randomThought)
  } else {
    sendText(strBotToken, chatId, `Message received: ${TimeStamp()}`)
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

  if (strNewText.startsWith("#")) {
    const arrNew = extractHashtags(strNewText)
    strTextReceived = findAndReturnAfterNewline(strNewText)
  }

  if (strOldText.startsWith("#")) {
    const arrOld = extractHashtags(strOldText)
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
