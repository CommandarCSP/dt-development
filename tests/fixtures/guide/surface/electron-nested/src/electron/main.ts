import { BrowserWindow, ipcMain } from 'electron';
function createWindow() {
  const win = new BrowserWindow({});
  return win;
}
ipcMain.handle('x:y', async () => {});
