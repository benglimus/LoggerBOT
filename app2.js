const { useState, useEffect } = React;

// Tab components
const InputTab = ({ msg, setMsg, test, setTest, send, loading, loadingLabel }) => (
  <div className="space-y-4">
    {/* Message Textarea */}
    <div>
      <label className="block text-sm font-medium mb-1">Message Text</label>
      <textarea
        id="msg"
        rows={3}
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600"
        value={msg}
        onChange={e => setMsg(e.target.value)}
      />
      <button
        title="Clear text"
        className="ml-2 text-gray-500 hover:text-gray-800"
        onClick={() => setMsg('')}
      >
        ❌
      </button>
    </div>

    {/* Send button */}
    <div className="flex justify-end">
      <button
        className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition flex items-center justify-center"
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
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600"
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
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-600"
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
  const [test, setTest] = useState('');
  const [logs, setLogs] = useState([]);
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState('input'); // settings | input | log
  const [menuOpen, setMenuOpen] = useState(false); // hamburger menu state
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [toast, setToast] = useState(null);

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

  // Send message with optional GPS location
  const send = async () => {
    setLoading(true);
    setLoadingLabel('Sending');
    const target = url || document.getElementById('url').value.trim();
    const chatId = cid || document.getElementById('cid').value.trim();
    if (!target || !chatId) {
      addLog('Aborted: Check configuration fields.', 'error');
      setLoading(false);
      setLoadingLabel('');
      return;
    }
    addLog('Requesting GPS tracking telemetry...', 'info');
    try {
      const p = await getCurrentPos();
      const { latitude: lat, longitude: lon } = p.coords;
      addLog(`GPS Lock: ${lat},${lon}`, 'success');
      const link = `https://maps.google.com/?q=${lat},${lon}`;
      const txt = `${msg}\n\n📍 Location: ${link}`;
      post(target, chatId, txt);
    } catch {
      addLog('GPS failed. Sending text fallback configuration…', 'error');
      post(target, chatId, msg);
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  // Helper to POST data to the webhook
  const post = (target, chatId, txt) => {
    addLog('Transmitting asynchronous data dispatch...', 'info');
    fetch(target, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { text: txt, chat: { id: Number(chatId) } } })
    })
      .then(() => addLog('Phase complete: Transmission accepted!', 'success'))
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
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => { setTab('input'); setMenuOpen(false); }}
              >
                Input
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => { setTab('settings'); setMenuOpen(false); }}
              >
                Settings
              </button>
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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
        {tab === 'input' && <InputTab msg={msg} setMsg={setMsg} test={test} setTest={setTest} send={send} loading={loading} loadingLabel={loadingLabel} />}
        {tab === 'log' && <LogTab logs={logs} testGPS={testGPS} loading={loading} loadingLabel={loadingLabel} />}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
