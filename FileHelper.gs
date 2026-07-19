
// function TEST_getFullFolderPath() {
//   // NOT WORKING PROPERLY FOR TELEGRAM CREATED FILES ... photos and files. No extension
//   var fileId = '190DE-Ppkc3t92W_aHKnav380p85e2gwS'; // Replace with the actual file ID
//   var filePath = getFullFolderPathWithFilenameAndExtension(fileId);

//   Logger.log('File Path:');
//   Logger.log(filePath);

// }

// Works for files uploaded directly to Google Drive but not for telegrambot generated files (no extension)
function getFullFolderPathWithFilenameAndExtension(fileId) {
  // Initialize an array to store the folder names in the path
  var folderNames = [];
  
  // Start with the given file ID
  var file = DriveApp.getFileById(fileId);
  
  // Split the file name by periods to extract the extension
  var fileNameParts = file.getName().split('.');
  console.log(file.getName())
  
  // Extract the file extension (last part of the split)
  var fileExtension = fileNameParts.pop();

  // Add the remaining parts as the filename (including periods) to the array
  var fileName = fileNameParts.join('.');
  folderNames.push(fileName);

  // Get the parent folder of the file (if it exists)
  try {
    var folder = file.getParents().next();
    
    while (folder) {
      // Add the folder's name to the array
      folderNames.push(folder.getName());
      
      // Move up to the parent folder
      var parent = folder.getParents().next();
      
      // If there's no parent folder, set folder to null to exit the loop
      if (!parent) {
        folder = null;
      } else {
        folder = parent;
      }
    }
  } catch (e) {
    // Handle the case where there are no parent folders (e.g., file is in My Drive)
  }
  
  // Reverse the array to get the correct path order
  folderNames.reverse();
  
  // Join the folder names with backslashes and add the file extension to form the full path
  var fullPath = folderNames.join("\\") + '.' + fileExtension;
  
  return fullPath;
}


function AppendToFile(folderPath, fileName, content) {
  try {
//    var folder = DriveApp.getFolderById(folderId);
    var folder = findOrCreateFolderByPath(folderPath)

    // Search for the file with the given fileName in the folder.
    var fileList = folder.getFilesByName(fileName);

    if (fileList.hasNext()) {
      // If the file already exists, append content to it.
      var file = fileList.next();
      var currentContent = file.getBlob().getDataAsString();
      var combinedContent = currentContent.length !== 0 ? currentContent + '\n' + content : content;
      file.setContent(combinedContent);
    } else {
      // If the file does not exist, create a new file with the content.
      folder.createFile(fileName, content);
    }

    // Return true to indicate success.
    return true;
  } catch (error) {
    // Handle errors here, and return false to indicate failure.
    console.error('Error appending to file:', error);
    return false;
  }
}

function findOrCreateFolderByPath(folderPath) {
  const folderNames = folderPath.split("/");
  let currentFolder = DriveApp.getRootFolder();

  // Check if the folderPath starts with a forward slash.
  if (folderNames[0] === "") {
    // Remove the empty first element.
    folderNames.shift();
  }

  for (const folderName of folderNames) {
    const folders = currentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      // If the folder doesn't exist, create it.
      currentFolder = currentFolder.createFolder(folderName);
    }
  }

  return currentFolder;
}


// function TEST_FileHelper() {
//   const folderPath = "/TelegramBOT/NOTES"
//   console.log(AppendToFile(folderPath,"TEST.TXT","A new line "+ TimeStamp()))
// }


function getDriveFileUrl(fileId) {
  // Construct URL directly — avoids DriveApp.getFileById() which needs OAuth scope
  // Standard Google Drive share URL format
  return `https://drive.google.com/open?id=${fileId}`
}

function readFileFromDrive(folderPath, fileName) {
  try {
    // Split the folderPath into individual folder names.
    var folders = folderPath.split("/").filter(function (folder) {
      return folder !== ""
    })

    if (folders.length === 0) {
      throw new Error("Invalid folder path: " + folderPath)
    }

    // Start with the root folder.
    var currentFolder = DriveApp.getRootFolder()

    // Traverse the folder path to find the target folder.
    for (var i = 0; i < folders.length; i++) {
      var folderName = folders[i]
      var subfolders = currentFolder.getFoldersByName(folderName)

      if (subfolders.hasNext()) {
        currentFolder = subfolders.next()
      } else {
        throw new Error("Folder not found: " + folderPath)
      }
    }

    // Search for the file by name within the target folder.
    var files = currentFolder.getFilesByName(fileName)
    if (!files.hasNext()) {
      throw new Error("File not found: " + fileName)
    }

    // Get the first file found with the specified name.
    var file = files.next()

    // Read the contents of the file.
    var fileContent = file.getBlob().getDataAsString()

    // You can return the content or do further processing with it.
    return fileContent
  } catch (e) {
    // Handle any errors that may occur.
    Logger.log("Error: " + e.toString())
    return null
  }
}

function saveTextStringToDrive(folderPath, fileName, content) {
  try {
    // Split the folderPath into individual folder names.
    var folders = folderPath.split("/").filter(function (folder) {
      return folder !== ""
    })

    if (folders.length === 0) {
      throw new Error("Invalid folder path: " + folderPath)
    }

    // Start with the root folder.
    var currentFolder = DriveApp.getRootFolder()

    // Traverse the folder path to find or create subfolders.
    for (var i = 0; i < folders.length; i++) {
      var folderName = folders[i]
      var subfolders = currentFolder.getFoldersByName(folderName)

      if (subfolders.hasNext()) {
        currentFolder = subfolders.next()
      } else {
        currentFolder = currentFolder.createFolder(folderName)
      }
    }

    // Search for the file by name within the folder.
    var files = currentFolder.getFilesByName(fileName)

    if (files.hasNext()) {
      // If the file already exists, overwrite it.
      var existingFile = files.next()
      existingFile.setContent(content)
    } else {
      // If the file doesn't exist, create a new one.
      currentFolder.createFile(fileName, content)
    }

    Logger.log("File saved to Drive: " + fileName)
    return true // Success
  } catch (e) {
    Logger.log("Error: " + e.toString())
    return false // Failure
  }
}



