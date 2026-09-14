import { BrowserWindow, ipcMain } from 'electron';
function createWindow() {
  const win = new BrowserWindow({ width: 1200, height: 800 });
  return win;
}
ipcMain.handle('project:list', async () => []);
ipcMain.handle('guide:open', async () => {});
