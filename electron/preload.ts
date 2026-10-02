import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('pokhair', {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('folder:select'),
  openFolder: (dir: string) => ipcRenderer.invoke('folder:open', dir),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  onFolderChanged: (callback: () => void) => {
    const listener = (_e: IpcRendererEvent) => callback();
    ipcRenderer.on('folder:changed', listener);
    return () => {
      ipcRenderer.removeListener('folder:changed', listener);
    };
  },
});
