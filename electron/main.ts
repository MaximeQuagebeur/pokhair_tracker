import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isDev = process.env.ELECTRON_DEV === '1';
const DEV_URL = 'http://localhost:3000/dashboard/';
const APP_SCHEME = 'app';
const APP_URL = `${APP_SCHEME}://local/dashboard/`;
const OUT_DIR = path.join(__dirname, '..', 'out');

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;
let allowedRoot: string | null = null;
let watcher: fs.FSWatcher | null = null;

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Serves the Next.js static export, mapping `/dashboard/` to `out/dashboard/index.html`. */
function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    let filePath = path.normalize(path.join(OUT_DIR, decodeURIComponent(pathname)));
    if (filePath !== OUT_DIR && !isInside(OUT_DIR, filePath)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
    else if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) filePath = path.join(OUT_DIR, '404.html');
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function defaultWinamaxDir(): string | undefined {
  const candidates = [
    path.join(app.getPath('appData'), 'winamax', 'documents', 'accounts'),
    path.join(app.getPath('home'), 'Library', 'Application Support', 'winamax', 'documents', 'accounts'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

async function listTxtFiles(dir: string, acc: { path: string; size: number; mtimeMs: number }[] = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await listTxtFiles(full, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt') && !/summary/i.test(entry.name)) {
      const stat = await fs.promises.stat(full);
      acc.push({ path: full, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
  return acc;
}

function startWatching(dir: string) {
  watcher?.close();
  let timer: NodeJS.Timeout | null = null;
  try {
    watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (filename && !filename.toString().toLowerCase().endsWith('.txt')) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => mainWindow?.webContents.send('folder:changed'), 1500);
    });
  } catch (err) {
    console.error('Watcher error', err);
    watcher = null;
  }
}

function registerIpc() {
  ipcMain.handle('folder:select', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choisir le dossier d'historique Winamax",
      message: 'Les fichiers ne sont pas affichés : sélectionnez simplement le dossier « history ».',
      buttonLabel: 'Sélectionner ce dossier',
      defaultPath: defaultWinamaxDir(),
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    allowedRoot = path.resolve(result.filePaths[0]);
    return allowedRoot;
  });

  ipcMain.handle('folder:open', async (_e, dir: string) => {
    const resolved = path.resolve(String(dir));
    const stat = await fs.promises.stat(resolved).catch(() => null);
    if (!stat?.isDirectory()) throw new Error(`Dossier introuvable : ${resolved}`);
    allowedRoot = resolved;
    startWatching(resolved);
    return listTxtFiles(resolved);
  });

  ipcMain.handle('file:read', async (_e, filePath: string) => {
    const resolved = path.resolve(String(filePath));
    if (!allowedRoot || !isInside(allowedRoot, resolved)) {
      throw new Error('Accès refusé : fichier hors du dossier sélectionné');
    }
    return fs.promises.readFile(resolved, 'utf-8');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#09090b',
    title: 'Pokhair Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the OS browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(isDev ? DEV_URL : APP_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Packaged builds get their icon from electron-builder; only the dev Dock needs it.
  if (isDev && process.platform === 'darwin') app.dock?.setIcon(path.join(__dirname, '..', 'build', 'icon.png'));
  registerAppProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});
