# Implementation Plan: Categories CRUD Endpoint & Frontend UI

## Goal Description
Implement API endpoints in Google Apps Script (`code.gs`) and a React-based management interface in `app.js` to perform Create, Read, Update, and Soft-Delete (CUD) operations on Categories. Categories are stored in a spreadsheet tab named `Categories` containing the following columns:
* **Name** (Column A)
* **Value** (Column B, used as the unique key)
* **Desc** (Column C)
* **Status** (Column D)

The React interface will be exposed as a new page ("Categories") in the hamburger menu, positioned directly after "Input".

---

## User Review Required
> [!IMPORTANT]
> **Soft Delete Implementation**: We will implement soft-delete by setting the `Status` column to `"Inactive"`. "Inactive" categories will still show in the management list (with a status badge) but can be toggled/activated/deactivated.
> 
> **CORS preflight prevention**: Google Apps Script web apps do not support `OPTIONS` preflight requests. To allow the React app to read the JSON response from Apps Script during POST requests (Create, Update, Delete), we must transmit payload requests as `text/plain` instead of `application/json`. Apps Script will still parse this content as JSON.
> 
> **Security Check**: To restrict access, the Apps Script will validate incoming requests against an `AUTHORIZED_CHAT_ID` value. Please add a row in your `BOT` config sheet with the key `AUTHORIZED_CHAT_ID` and your Chat ID as the value.

---

## Open Questions
> [!NOTE]
> None. Requirements have been fully aligned:
> 1. Status field will be toggled to `"Inactive"` for deletions.
> 2. The Categories page will be added to the hamburger menu directly after "Input".
> 3. Security checks will validate the Chat ID against `AUTHORIZED_CHAT_ID` configuration.

---

## Proposed Changes

### Backend: code.gs
#### [MODIFY] `code.gs`
We will expand the routing switch-case in `doPost(e)` and `doGet(e)` to route to our category handlers and include security checks.

```javascript
// Add sheet constant
const CATEGORIES_SHEET = "Categories";
```

##### 1. Route `doGet(e)` and `doPost(e)`
We will add support to `doGet(e)` for listing categories, and support to `doPost(e)` for create, update, and delete actions. All endpoints except Telegram fallback logging will check authorization.

```javascript
function doGet(e) {
  const endpoint = (e && e.parameter && e.parameter.endpoint);
  
  if (endpoint === "getCategories") {
    if (!checkAuthorization(e, null)) {
      return createJsonResponse({ status: "error", message: "Unauthorized request" });
    }
    return handleGetCategories();
  }
  
  // Existing doGet baseline fallback
  const name = getMe().result.first_name;
  const output = `Hello, my name is ${name}`;
  return ContentService.createTextOutput(output);
}
```

Add routes to `doPost(e)`:
```javascript
  // Route by query param (?endpoint=...) OR body param (data.endpoint) OR default to "log"
  const endpoint = (e && e.parameter && e.parameter.endpoint) || data.endpoint || "log";

  // Check authorization for all custom endpoint requests
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
      return handleDeleteCategory(data); // Will perform soft delete
    default:
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Unknown endpoint: " + endpoint
      })).setMimeType(ContentService.MimeType.JSON);
  }
```

##### 2. Implementation of Authorization check & CRUD Handlers

```javascript
// Authorization check helper
function checkAuthorization(e, data) {
  const authorizedId = getConfig("AUTHORIZED_CHAT_ID");
  if (!authorizedId) {
    // If not configured, allow access but log a message
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

// Helper to construct JSON response output
function createJsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

### Frontend: app.js
#### [MODIFY] `app.js`
We will introduce:
1. **`CategoriesTab` Component**: A clean interface showing a list of existing categories with status badges, an "Add Category" form, and controls to edit or toggle category status.
2. **Menu updates**: Insert `Categories` into the hamburger menu right after `Input`.
3. **State addition**: `categories` state, fetched on tab switch.

```javascript
// Add CategoriesTab component
const CategoriesTab = ({ categories, fetchCategories, createCategory, updateCategory, loading }) => {
  const [form, setForm] = React.useState({ name: '', value: '', desc: '', status: 'Active' });
  const [editing, setEditing] = React.useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      updateCategory(editing.value, form);
      setEditing(null);
    } else {
      createCategory(form);
    }
    setForm({ name: '', value: '', desc: '', status: 'Active' });
  };

  const handleEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, value: c.value, desc: c.desc, status: c.status });
  };

  return (
    <div className="space-y-6">
      {/* Add / Edit Form */}
      <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-3">
        <h3 className="font-semibold text-sm">{editing ? 'Edit Category' : 'Create Category'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Name (e.g. Work)"
            className="px-2 py-1 border rounded text-sm focus:outline-indigo-600"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            required
          />
          <input
            placeholder="Value (e.g. work)"
            className="px-2 py-1 border rounded text-sm focus:outline-indigo-600"
            value={form.value}
            onChange={e => setForm({...form, value: e.target.value})}
            disabled={!!editing}
            required
          />
        </div>
        <input
          placeholder="Description"
          className="w-full px-2 py-1 border rounded text-sm focus:outline-indigo-600"
          value={form.desc}
          onChange={e => setForm({...form, desc: e.target.value})}
        />
        <div className="flex justify-between items-center">
          <select
            className="px-2 py-1 border rounded text-sm"
            value={form.status}
            onChange={e => setForm({...form, status: e.target.value})}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <div className="space-x-1">
            {editing && (
              <button
                type="button"
                className="px-3 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400"
                onClick={() => { setEditing(null); setForm({ name: '', value: '', desc: '', status: 'Active' }); }}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
              {editing ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </form>

      {/* Categories List */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-sm">Existing Categories</h3>
          <button onClick={fetchCategories} className="text-xs text-indigo-600 hover:underline">🔄 Refresh</button>
        </div>
        
        {loading ? (
          <div className="text-sm text-gray-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-gray-500">No categories found.</div>
        ) : (
          <div className="divide-y border rounded-lg bg-white dark:bg-gray-800 max-h-60 overflow-y-auto">
            {categories.map((c) => (
              <div key={c.value} className="p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-400">({c.value})</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {c.status}
                    </span>
                  </div>
                  {c.desc && <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>}
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button 
                    onClick={() => updateCategory(c.value, { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' })}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Toggle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## Verification Plan

### Manual Verification
Ensure that the `Categories` sheet exists in Google Sheets with headers `Name`, `Value`, `Desc`, `Status`.

1. **Verify Navigation**:
   * Open the hamburger menu.
   * Click **Categories** (positioned right after **Input**).
   * Confirm the view loads.

2. **Verify Security Checks**:
   * Try loading the Categories list when Chat ID is set incorrectly. Verify that the UI displays a network error or "Unauthorized request".
   * Correct the Chat ID and verify the categories list fetches successfully.

3. **Verify READ (Fetch Categories)**:
   * Upon opening the Categories tab, verify that existing categories in Google Sheets are rendered with appropriate names and status badges.

4. **Verify CREATE**:
   * Add a new category (e.g. `urgent` with name `Urgent Tasks`).
   * Confirm it appends to the sheet and is added to the React list on refresh.

5. **Verify UPDATE**:
   * Click **Edit** next to `urgent`. Change description to `High Priority`.
   * Click **Update**.
   * Confirm the row update is reflected in Google Sheets.

6. **Verify SOFT DELETE (Deactivate)**:
   * Click **Toggle** next to `urgent`.
   * Confirm its status changes to `"Inactive"` in both the UI and the Google Sheet.
