const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
let window;
let server;
let quitting = false;
app.setName('Gradus ad Parnassum');
if (process.env.GRADUS_DESKTOP_DATA) app.setPath('userData', process.env.GRADUS_DESKTOP_DATA);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
async function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 1000, minWidth: 850, minHeight: 650,
    title: 'Gradus ad Parnassum', backgroundColor: '#f7f5ef',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  const origin = 'http://127.0.0.1:4175';
  const external = (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); external(url); }
  });
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting) dialog.showErrorBox('Gradus stopped', `The score window stopped (${details.reason}). Quit and reopen Gradus. Your saved notebook is retained.`);
  });
  window.on('closed', () => { window = null; });
  await window.loadURL(origin);
}
if (locked) app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  process.env.GRADUS_DB = path.join(userData, 'gradus.sqlite');
  process.env.PORT = '4175';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [ { role: 'about' }, { type: 'separator' },
      { label: 'Show Notebook Folder', click: () => shell.openPath(userData) },
      { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' } ] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  const backend = await import(pathToFileURL(path.join(__dirname, '..', 'server.mjs')).href);
  server = await backend.ready;
  await createWindow();
  if (process.env.GRADUS_SMOKE_TEST) {
    const result = await window.webContents.executeJavaScript(`(async () => {
      const library = await fetch('/api/library').then(r => r.json());
      const sources = await fetch('/sources/fux.json').then(r => r.json());
      await new Promise(r => setTimeout(r, 2500));
      return { title: document.title, text: document.body.innerText.slice(0, 1500), library: Array.isArray(library), sources: !!sources, nodeDisabled: typeof require === 'undefined' };
    })()`);
    fs.writeFileSync(path.join(userData, 'smoke-result.json'), JSON.stringify(result, null, 2));
    app.quit();
  }
}).catch((error) => {
  dialog.showErrorBox('Gradus could not start', `${error.message}\n\nIf port 4175 is in use, close the other application and try again. Your notebook is stored in ${app.getPath('userData')}.`);
  app.exit(1);
});
app.on('activate', () => { if (!window && server) createWindow().catch(e => dialog.showErrorBox('Could not open Gradus', e.message)); });
app.on('before-quit', () => { quitting = true; server?.close(); });
app.on('window-all-closed', () => app.quit());
