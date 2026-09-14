import { Menu, shell } from 'electron';
Menu.buildFromTemplate([
  { label: '설정', click: () => {} },
  { label: '업데이트 확인…', click: () => {} },
  { label: '도움말', click: () => shell.openExternal('https://example.com/help') },
]);
