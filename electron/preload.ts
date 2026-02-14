import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    // Expose secure APIs here
    // e.g. sendNotification: (message: string) => ipcRenderer.send('notify', message)
});
