//LoggerBOT
const strBotToken = getConfig("BOT_TOKEN")
const webAppUrl = getConfig("WEBAPP_URL")
// const FILES_FOLDER_PATH = getConfig("FILES_FOLDER_PATH")
const NOTES_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")
const FILES_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")+"/"+getConfig("FILES_SUBFOLDER")
const PHOTOS_FOLDER_PATH = getConfig("NOTES_FOLDER_PATH")+"/"+getConfig("PHOTOS_SUBFOLDER")
const DEBUG_SHEET = getConfig("DEBUG_SHEET")
const MESSAGES_SHEET = getConfig("MESSAGES_SHEET")
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
//    const thoughts = array.filter(function(n){ return n != '' });
    return (thoughts[rnd]+"")
}

// Updated again
function onOpen() {
  var ui = SpreadsheetApp.getUi()
  // Or DocumentApp or FormApp.
  ui.createMenu("Run Scripts")
    .addItem("getMe", "MENU_getMe")
    .addItem("setWebhook", "MENU_setWebhook")
    .addItem("removeWebhook", "MENU_removeWebhook")
    //      .addItem('First item', 'menuItem1')
    //      .addSeparator()
    //      .addSubMenu(ui.createMenu('Sub-menu')
    //          .addItem('Second item', 'menuItem2'))
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
  //  console.log(ConfigItems)
  let result = ""
  for (let i = 0, len = ConfigItems.length; i < len; i++) {
    if (ConfigItems[i][0] === item) {
      result = ConfigItems[i][1]
      break
    }
  }
  return result
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

function doGet() {
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

  if (endpoint === "log") {
    return handleLog(data);
  } else {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Unknown endpoint: " + endpoint
    })).setMimeType(ContentService.MimeType.JSON);
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
      strTextReceived,
      strPhotoUrl,
      strFilename,
      strFileUrl,
      strNote,
      blnNoteUpdated
    ])
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
  //Split into lines
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
  // Trim the input strings and initialize tags and body.
  const strNewText = strTextReceived.trim()
  const strOldText = strTextExisting.trim()
  let strTags = ""
  let strBody = ""

  // Extract and process hashtags in the received text.
  if (strNewText.startsWith("#")) {
    const arrNew = extractHashtags(strNewText)
    // Remove hashtags and leading newline from the text.
    strTextReceived = findAndReturnAfterNewline(strNewText)
  }

  // Extract and process hashtags in the existing text.
  if (strOldText.startsWith("#")) {
    const arrOld = extractHashtags(strOldText)
    // Remove hashtags and leading newline from the text.
    strTextExisting = findAndReturnAfterNewline(strOldText)
  }

  // Merge and sort the old and new tag arrays to eliminate duplicates.
  const mergedTags = mergeAndSortArrays(arrOld, arrNew)
  strTags = mergedTags.join(" ").trim() + "\n"

  // Combine the remaining body text.
  strBody = strTextExisting + "\n" + strTextReceived

  // Combine tags and body text to form the final note.
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

    // Handle the case where folderPath is an empty string or '/'
    if (folderPath === "" || folderPath === "/") {
      folderPath = "" // Ensure folderPath is an empty string
    } else {
      // Remove leading and trailing slashes to ensure folderPath is formatted correctly
      folderPath = folderPath.replace(/^\/|\/$/g, "")
    }

    // Find the target folder by its path.
    const targetFolder = findOrCreateFolderByPath(folderPath)

    const driveFile = targetFolder.createFile(fileBlob)
    //    driveFile.setName(chatId + '_' + telegramFile.file_id); // Set a unique name for the file
//    driveFile.setName(chatId + "_" + UniqueID()) // Set a unique name for the file
    driveFile.setName(filename) // Set a unique name for the file
    return driveFile.getId()
  } catch (e) {
    // Handle any errors that may occur.
    Logger.log("Error: " + e.toString())
    return null
  }
}

