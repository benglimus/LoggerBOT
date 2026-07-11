const { useState, useEffect } = React;

// Tab components
const InputTab = ({ msg, setMsg, send, loading, loadingLabel, selectedFile, setSelectedFile, imagePreview, setImagePreview }) => {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
  };

  return (
    <div className="space-y-4">
      {/* Message Textarea */}
      <div>
        <label className="block text-sm font-medium mb-1">Message Text</label>
        <div className="relative flex items-center">
          <textarea
            id="msg"
            rows={3}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 pr-10"
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <button
            title="Clear text"
            className="absolute right-2 top-2 text-gray-500 hover:text-gray-800 focus:outline-none"
            onClick={() => setMsg('')}
          >
            ❌
          </button>
        </div>
      </div>

      {/* Attach Image field */}
      <div>
        <label className="block text-sm font-medium mb-1">Attach Image</label>
        <div className="flex items-center space-x-2">
          <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm font-medium py-2 px-4 rounded border dark:border-gray-600 transition flex items-center space-x-1">
            <span>📷 Choose Image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {selectedFile && (
            <span className="text-xs text-gray-500 truncate max-w-[150px]">
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative inline-block mt-2">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-[150px] max-h-[150px] rounded-lg border border-gray-300 shadow-sm object-cover"
          />
          <button
            type="button"
            onClick={handleClearFile}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition shadow focus:outline-none"
            title="Remove image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Send button */}
      <div className="flex justify-end">
        <button
          className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition flex items-center justify-center font-medium"
          onClick={send}
          disabled={loading}
        >
          {loading && loadingLabel === 'Sending' && (
            <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
          )}
          Log
        </button>
      </div>
    </div>
  );
};

// Categories tab component
const CategoriesTab = ({ categories, fetchCategories, createCategory, updateCategory, loading }) => {
  const [form, setForm] = useState({ name: '', value: '', desc: '', status: 'Active' });
  const [editing, setEditing] = useState(null);

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
            className="px-2 py-1 border rounded text-sm focus:outline-indigo-600 bg-white dark:bg-gray-800"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            required
          />
          <input
            placeholder="Value (e.g. work)"
            className="px-2 py-1 border rounded text-sm focus:outline-indigo-600 bg-white dark:bg-gray-800"
            value={form.value}
            onChange={e => setForm({...form, value: e.target.value})}
            disabled={!!editing}
            required
          />
        </div>
        <input
          placeholder="Description"
          className="w-full px-2 py-1 border rounded text-sm focus:outline-indigo-600 bg-white dark:bg-gray-800"
          value={form.desc}
          onChange={e => setForm({...form, desc: e.target.value})}
        />
        <div className="flex justify-between items-center">
          <select
            className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800"
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
                className="px-3 py-1 bg-gray-300 rounded text-sm hover:bg-gray-400 text-gray-800"
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
          <button type="button" onClick={fetchCategories} className="text-xs text-indigo-600 hover:underline">🔄 Refresh</button>
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
                  <button type="button" onClick={() => handleEdit(c)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button 
                    type="button"
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

const LogTab = ({ logs, testGPS, loading, loadingLabel }) => (
  <div className="space-y-2">
    <button
      className="bg-gray-600 text-white py-1 px-3 rounded hover:bg-gray-700 transition flex items-center"
      onClick={testGPS}
      disabled={loading}
    >
      {loading && loadingLabel === 'Testing GPS' && (
        <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      )}
      Test Location Only
    </button>
    <div className="max-h-64 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs space-y-1">
      {logs.map((l, i) => (
        <div
          key={i}
          className={
            l.kind === 'error' ? 'text-red-500' :
              l.kind === 'success' ? 'text-green-500' :
                l.kind === 'info' ? 'text-blue-400' : ''
          }
        >
          [{new Date().toLocaleTimeString()}] {l.text}
        </div>
      ))}
    </div>
  </div>
);

// Settings tab component
const SettingsTab = ({ url, setUrl, cid, setCid, saveUrl, saveCid, loading, loadingLabel }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">Webhook URL</label>
      <input
        id="url"
        type="text"
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-800"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com/webhook"
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Chat ID</label>
      <input
        id="cid"
        type="text"
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-800"
        value={cid}
        onChange={e => setCid(e.target.value)}
        placeholder="123456789"
      />
    </div>
    <div className="flex justify-end">
      <button
        className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition flex items-center"
        onClick={() => { saveUrl(url); saveCid(cid); }}
        disabled={loading}
      >
        {loading && loadingLabel === 'Saving' && (
          <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
        )}
        Save
      </button>
    </div>
  </div>
);

function App() {
  // Core state
  const [url, setUrl] = useState(localStorage.getItem('tg_url') || '');
  const [cid, setCid] = useState(localStorage.getItem('tg_cid') || '');
  const [msg, setMsg] = useState('Hello from iPhone mobile hardware!');
  const [logs, setLogs] = useState([]);
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState('input'); // settings | input | log | categories
  const [menuOpen, setMenuOpen] = useState(false); // hamburger menu state
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [toast, setToast] = useState(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Categories list state
  const [categories, setCategories] = useState([]);

  // Helper to push a log entry
  const addLog = (text, kind) => {
    setLogs(prev => [...prev, { text, kind }]);
    if (kind === 'success' || kind === 'error') {
      setToast({ msg: text, kind });
    }
  };

  // Initial environment log
  useEffect(() => {
    addLog('Environment Secure Context: ' + window.isSecureContext, 'info');
    if (url && cid) addLog('Saved parameters loaded. Ready.', 'success');
  }, []);

  // Dark mode side‑effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Persist helpers
  const saveUrl = val => {
    const trimmed = val.trim();
    setUrl(trimmed);
    localStorage.setItem('tg_url', trimmed);
    addLog('Webhook URL saved.', 'success');
  };

  const saveCid = val => {
    const trimmed = val.trim();
    setCid(trimmed);
    localStorage.setItem('tg_cid', trimmed);
    addLog('Chat ID saved.', 'success');
  };

  // Shared helper to acquire a single position (returns a Promise)
  const getCurrentPos = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });

  // Auto‑dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Categories list
  const fetchCategories = async () => {
    setLoading(true);
    setLoadingLabel('Loading categories');
    const target = url || (document.getElementById('url') ? document.getElementById('url').value.trim() : '');
    const chatId = cid || (document.getElementById('cid') ? document.getElementById('cid').value.trim() : '');
    if (!target) {
      addLog('Aborted: Check Webhook URL in settings.', 'error');
      setLoading(false);
      setLoadingLabel('');
      return;
    }
    
    const fetchUrl = `${target}${target.includes('?') ? '&' : '?'}endpoint=getCategories&chatId=${chatId}`;
    try {
      const response = await fetch(fetchUrl);
      const data = await response.json();
      if (data && data.status === 'error') {
        addLog(`Error loading categories: ${data.message}`, 'error');
      } else if (Array.isArray(data)) {
        setCategories(data);
        addLog('Categories loaded successfully.', 'success');
      } else {
        addLog('Error: Invalid response format.', 'error');
      }
    } catch (err) {
      addLog(`Network error: ` + err.message, 'error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Create Category
  const createCategory = async (cat) => {
    setLoading(true);
    setLoadingLabel('Creating category');
    const target = url || (document.getElementById('url') ? document.getElementById('url').value.trim() : '');
    const chatId = cid || (document.getElementById('cid') ? document.getElementById('cid').value.trim() : '');
    if (!target) {
      addLog('Aborted: Check Webhook URL in settings.', 'error');
      setLoading(false);
      setLoadingLabel('');
      return;
    }
    
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          endpoint: 'createCategory',
          chatId: chatId,
          name: cat.name,
          value: cat.value,
          desc: cat.desc,
          status: cat.status
        })
      });
      const data = await response.json();
      if (data && data.status === 'success') {
        addLog('Category created successfully.', 'success');
        fetchCategories();
      } else {
        addLog(`Failed to create category: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      addLog(`Network error creating category: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Update / Soft-delete Category
  const updateCategory = async (origVal, cat) => {
    setLoading(true);
    setLoadingLabel('Updating category');
    const target = url || (document.getElementById('url') ? document.getElementById('url').value.trim() : '');
    const chatId = cid || (document.getElementById('cid') ? document.getElementById('cid').value.trim() : '');
    if (!target) {
      addLog('Aborted: Check Webhook URL in settings.', 'error');
      setLoading(false);
      setLoadingLabel('');
      return;
    }
    
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          endpoint: 'updateCategory',
          chatId: chatId,
          originalValue: origVal,
          name: cat.name,
          value: cat.value,
          desc: cat.desc,
          status: cat.status
        })
      });
      const data = await response.json();
      if (data && data.status === 'success') {
        addLog('Category updated successfully.', 'success');
        fetchCategories();
      } else {
        addLog(`Failed to update category: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      addLog(`Network error updating category: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Fetch categories list on tab enter
  useEffect(() => {
    if (tab === 'categories') {
      fetchCategories();
    }
  }, [tab]);

  // GPS test (used from Input tab)
  const testGPS = async () => {
    setLoading(true);
    setLoadingLabel('Testing GPS');
    addLog('Testing location acquisition…', 'info');
    try {
      const p = await getCurrentPos();
      addLog(`SUCCESS! Coordinates: ${p.coords.latitude},${p.coords.longitude}`, 'success');
    } catch (e) {
      addLog(`Hardware Failed: ${e.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Send message with optional GPS location and optional image
  const send = async () => {
    setLoading(true);
    setLoadingLabel('Sending');
    const target = url || (document.getElementById('url') ? document.getElementById('url').value.trim() : '');
    const chatId = cid || (document.getElementById('cid') ? document.getElementById('cid').value.trim() : '');
    if (!target || !chatId) {
      addLog('Aborted: Check configuration fields.', 'error');
      setLoading(false);
      setLoadingLabel('');
      return;
    }
    addLog('Requesting GPS tracking telemetry...', 'info');

    const photoData = imagePreview;
    const photoName = selectedFile ? selectedFile.name : null;

    try {
      const p = await getCurrentPos();
      const { latitude: lat, longitude: lon } = p.coords;
      addLog(`GPS Lock: ${lat},${lon}`, 'success');
      const link = `https://maps.google.com/?q=${lat},${lon}`;
      const txt = `${msg}\n\n📍 Location: ${link}`;
      post(target, chatId, txt, photoData, photoName);
    } catch {
      addLog('GPS failed. Sending text fallback configuration…', 'error');
      post(target, chatId, msg, photoData, photoName);
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Helper to POST data to the webhook
  const post = (target, chatId, txt, photoData = null, photoName = null) => {
    addLog('Transmitting asynchronous data dispatch...', 'info');
    const bodyObj = {
      message: {
        text: txt,
        chat: { id: Number(chatId) }
      }
    };
    if (photoData) {
      bodyObj.message.photoData = photoData;
      bodyObj.message.photoName = photoName;
    }
    fetch(target, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    })
      .then(() => {
        addLog('Phase complete: Transmission accepted!', 'success');
        setSelectedFile(null);
        setImagePreview(null);
      })
      .catch(err => addLog('Network error: ' + err.message, 'error'));
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-white ${toast.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">Universal Logger</h2>
        <button className="text-sm text-gray-500" onClick={() => setDark(!dark)}>
          {dark ? 'Light' : 'Dark'} Mode
        </button>
        {/* Hamburger menu */}
        <div className="relative">
          <button
            className="p-2 focus:outline-none"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                onClick={() => { setTab('input'); setMenuOpen(false); }}
              >
                Input
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                onClick={() => { setTab('categories'); setMenuOpen(false); }}
              >
                Categories
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                onClick={() => { setTab('settings'); setMenuOpen(false); }}
              >
                Settings
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                onClick={() => { setTab('log'); setMenuOpen(false); }}
              >
                Log
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="pt-2">
        {tab === 'settings' && <SettingsTab url={url} setUrl={setUrl} cid={cid} setCid={setCid} saveUrl={saveUrl} saveCid={saveCid} loading={loading} loadingLabel={loadingLabel} />}
        {tab === 'input' && (
          <InputTab
            msg={msg}
            setMsg={setMsg}
            send={send}
            loading={loading}
            loadingLabel={loadingLabel}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
          />
        )}
        {tab === 'categories' && (
          <CategoriesTab
            categories={categories}
            fetchCategories={fetchCategories}
            createCategory={createCategory}
            updateCategory={updateCategory}
            loading={loading}
          />
        )}
        {tab === 'log' && <LogTab logs={logs} testGPS={testGPS} loading={loading} loadingLabel={loadingLabel} />}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
