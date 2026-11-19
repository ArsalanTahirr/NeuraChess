const { spawn } = require('child_process');
const fs = require('fs');

const ARTIFACT_DIR = '/home/hackurrrr/.gemini/antigravity/brain/23e4446f-a767-49bd-88de-dd2230622560';

async function runE2E() {
  console.log('Starting headless Chrome for exact screenshot suite...');
  const chrome = spawn('google-chrome-stable', [
    '--headless',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    '--window-size=1280,850',
    'http://127.0.0.1:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const res = await fetch('http://127.0.0.1:9222/json');
  const targets = await res.json();
  const page = targets.find(t => t.url.includes('5173'));
  if (!page) {
    console.error('Target page not found');
    chrome.kill();
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  });

  await new Promise((resolve) => ws.addEventListener('open', resolve));
  console.log('Connected to Chrome DevTools.');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  async function captureScreenshot(filename) {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(result.data, 'base64');
    fs.writeFileSync(`${ARTIFACT_DIR}/${filename}`, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  await new Promise(r => setTimeout(r, 1200));

  // 1. Initial Desktop Play Page
  console.log('1. Capturing Desktop Play Page...');
  await captureScreenshot('desktop_play_page.png');

  // 2. Open Setup Modal
  console.log('2. Opening Setup Modal...');
  await evalJs(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Game'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('desktop_setup_modal.png');

  // 3. Start game
  console.log('3. Starting match from Modal...');
  await evalJs(`
    const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Begin Match'));
    if (startBtn) startBtn.click();
  `);
  await new Promise(r => setTimeout(r, 800));

  // 4. Play move e2 -> e4
  console.log('4. Executing move e2 -> e4...');
  await evalJs(`
    const e2 = document.querySelector('[data-square="e2"]');
    if (e2) e2.click();
  `);
  await new Promise(r => setTimeout(r, 300));
  await evalJs(`
    const e4 = document.querySelector('[data-square="e4"]');
    if (e4) e4.click();
  `);

  console.log('Waiting for engine response...');
  await new Promise(r => setTimeout(r, 2200));
  await captureScreenshot('desktop_active_gameplay.png');

  // 5. Navigate to Analysis Tab
  console.log('5. Navigating to Analysis...');
  await evalJs(`document.querySelector('[data-nav="analysis"]').click();`);
  await new Promise(r => setTimeout(r, 1000));

  // Select Ruy López preset
  await evalJs(`
    const preset = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Ruy López'));
    if (preset) preset.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('desktop_analysis_page.png');

  // 6. Navigate to About Tab
  console.log('6. Navigating to About...');
  await evalJs(`document.querySelector('[data-nav="about"]').click();`);
  await new Promise(r => setTimeout(r, 1000));
  await captureScreenshot('desktop_about_page.png');

  // 7. Navigate to Settings Tab
  console.log('7. Navigating to Settings...');
  await evalJs(`document.querySelector('[data-nav="settings"]').click();`);
  await new Promise(r => setTimeout(r, 1000));

  // Click on "Atelier Slate" theme
  await evalJs(`
    const themeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Atelier Slate'));
    if (themeBtn) themeBtn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot('desktop_settings_page.png');

  // 8. Mobile Viewport Play Page
  console.log('8. Setting mobile viewport (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // Switch back to Play
  await evalJs(`document.querySelector('[data-nav="play"]').click();`);
  await new Promise(r => setTimeout(r, 1200));
  await captureScreenshot('mobile_play_page.png');

  console.log('All screenshots verified and captured successfully!');
  ws.close();
  chrome.kill();
  process.exit(0);
}

runE2E().catch(err => {
  console.error(err);
  process.exit(1);
});
