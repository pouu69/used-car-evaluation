import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'daksin-car (MVP)',
  version: '0.1.0',
  description: '엔카 매물 자동 평가 — 닥신 11 룰 체크리스트',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_title: 'daksin-car',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  permissions: ['storage', 'sidePanel', 'cookies', 'alarms', 'scripting', 'tabs'],
  host_permissions: [
    'https://fem.encar.com/*',
    'https://car.encar.com/*',
    'https://api.encar.com/*',
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://fem.encar.com/cars/detail/*'],
      js: ['src/content/fem-encar/main-world.ts'],
      run_at: 'document_idle',
      world: 'MAIN',
    },
    {
      matches: ['https://fem.encar.com/cars/detail/*'],
      js: ['src/content/fem-encar/index.ts'],
      run_at: 'document_idle',
      world: 'ISOLATED',
    },
  ],
});
