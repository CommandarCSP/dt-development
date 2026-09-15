ipcMain.handle('doc:save', async (_e, payload) => save(payload));
ipcMain.on('app:quit', () => app.quit());
