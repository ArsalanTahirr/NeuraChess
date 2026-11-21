const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { Chess } = require('chess.js');

const frontendUrl = process.env.E2E_FRONTEND_URL || 'http://127.0.0.1:4173';
const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const screenshotDir = process.env.E2E_SCREENSHOT_DIR;

async function waitFor(description, check) {
  const deadline = Date.now() + 12_000;
  do {
    const result = await check();
    if (result) return result;
    await delay(60);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${description}`);
}

async function getJson(path, options) {
  const response = await fetch(apiUrl + path, options);
  assert.ok(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

async function connect(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();
  const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const requests = new Map();
  const exceptions = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    const params = message.params;
    if (message.method === 'Network.requestWillBeSent' && params.request.method === 'POST') {
      requests.set(params.requestId, { path: new URL(params.request.url).pathname });
    }
    const request = requests.get(params?.requestId);
    if (request && message.method === 'Network.responseReceived') request.status = params.response.status;
    if (request && message.method === 'Network.loadingFinished') request.finished = true;
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);
    }
  });
  socket.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('Chrome DevTools disconnected'));
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = ++id;
      pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
  }

  return { send, socket, requests, exceptions };
}

async function verifyGameplay({ send, requests, exceptions }) {
  const scripts = [
    send('Page.enable'),
    send('Runtime.enable'),
    send('Network.enable'),
    send('Emulation.setDeviceMetricsOverride', {
      width: 1360, height: 900, deviceScaleFactor: 1, mobile: false,
    }),
  ];
  await Promise.all(scripts);
  await send('Page.navigate', { url: frontendUrl });

  async function evaluate(fn, ...args) {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: `(${fn.toString()})(...${JSON.stringify(args)})`,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }

  const pageHas = (label) => evaluate((text) => document.body?.innerText.includes(text) ?? false, label);
  const waitForText = (label) => waitFor(label, () => pageHas(label));
  const click = (label) => waitFor(`the ${label} button`, () => evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((element) =>
      (element.textContent.trim() === text || element.getAttribute('aria-label') === text) && !element.disabled);
    if (!button) return false;
    button.click();
    return true;
  }, label));
  const clickWithMouse = async (label) => {
    const point = await waitFor(label, () => evaluate((text) => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        (element.textContent.trim() === text || element.getAttribute('aria-label') === text) && !element.disabled);
      if (!button) return null;
      button.scrollIntoView({ block: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      return button.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    }, label));
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    }
  };
  const square = (name) => waitFor(`square ${name}`, () => evaluate((value) => {
    const target = document.querySelector(`[data-square="${value}"]`);
    if (!target) return false;
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    target.click();
    return true;
  }, name));
  const select = (selector, value) => evaluate((path, option) => {
    const input = document.querySelector(path);
    if (!input) return false;
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, option);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    return true;
  }, selector, value);
  const requestSince = (path, baseline) => waitFor(path, () =>
    [...requests].find(([id, request]) => !baseline.has(id) && request.path === path && request.finished));
  const snapshot = () => new Set(requests.keys());
  const gameRequest = async (action, baseline) => {
    const [, request] = await requestSince(`${gamePath}/${action}`, baseline);
    assert.equal(request.status, 200);
    return getJson(gamePath);
  };

  let gamePath;
  async function startMatch(color, mode) {
    if (!(await pageHas('Begin Match'))) await click('New Game');
    await click(color === 'white' ? 'Play as White' : 'Play as Black');
    assert.ok(await select('input[aria-label="Calculation depth"]', '1'));
    await waitForText('Depth 1');
    assert.ok(await select('#game-evaluation', mode));
    const baseline = snapshot();
    await click('Begin Match');
    let state;
    if (gamePath) {
      state = await gameRequest('reset', baseline);
    } else {
      const [id, request] = await requestSince('/games', baseline);
      assert.equal(request.status, 201);
      const { body } = await send('Network.getResponseBody', { requestId: id });
      state = JSON.parse(body);
      gamePath = `/games/${state.id}`;
    }
    assert.equal(state.settings.playerColor, color);
    assert.equal(state.settings.evaluationMode, mode);
    assert.equal(state.settings.maxDepth, 1);
    await waitFor('match setup to close', async () => !(await pageHas('Begin Match') || await pageHas('Starting…')));
    return baseline;
  }

  async function play(from, to, plies, mode) {
    const baseline = snapshot();
    await square(from);
    await square(to);
    const state = await gameRequest('engine-move', baseline);
    assert.equal(state.moveHistory.length, plies);
    assert.equal(state.moveHistory.at(-2).uci, from + to);
    assert.equal(state.lastSearch.evaluationMode, mode);
    assert.equal(state.lastSearch.move, state.moveHistory.at(-1).uci);
    const sent = [...requests].filter(([id, req]) => !baseline.has(id) && req.path === `${gamePath}/engine-move`);
    assert.equal(sent.length, 1, 'One engine request per turn');
    await waitForText(`${plies} plies`);
    const ledger = state.moveHistory.at(-1).san;
    await waitFor(`engine SAN ${ledger} in the ledger`, () => evaluate((san) =>
      [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === san), ledger));
    const destination = state.lastSearch.move.slice(2, 4);
    const piece = new Chess(state.fen).get(destination);
    await waitFor(`the engine piece on ${destination}`, () => evaluate((squareName, pieceName) =>
      document.querySelector(`[data-square="${squareName}"] [data-piece="${pieceName}"]`) !== null,
    destination, piece.color + piece.type.toUpperCase()));
    return state;
  }

  async function screenshot(name) {
    if (!screenshotDir) return;
    mkdirSync(screenshotDir, { recursive: true });
    await delay(300);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshotDir, `${name}.png`), Buffer.from(data, 'base64'));
  }

  await waitForText('Begin Match');
  assert.ok(await evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog.querySelector('#game-evaluation').value === '' &&
      [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Begin Match').disabled;
  }));
  assert.ok(![...requests.values()].some((request) => request.path === '/games'));
  await click('Dismiss');

  const monitorAudio = () => evaluate(() => {
    window.playedClips = 0;
    const observed = new WeakSet();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!observed.has(this)) {
        observed.add(this);
        this.addEventListener('playing', () => {
          if (!this.muted && this.volume > 0 && this.duration > 0) window.playedClips += 1;
        });
      }
      return play.call(this);
    };
  });
  await monitorAudio();
  await click('Settings');
  await clickWithMouse('Move Sounds');
  await waitFor('the sound preview', async () => (await evaluate(() => window.playedClips)) === 1);
  await click('Play');
  await startMatch('white', 'material');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536, height: 711, deviceScaleFactor: 1.25, mobile: false,
  });
  await waitFor('the desktop Play page to fit the viewport', () => evaluate(() =>
    document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight));
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  const boardLocation = () => evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    left: document.querySelector('[data-square="a8"]').getBoundingClientRect().left,
    top: document.querySelector('[data-square="a8"]').getBoundingClientRect().top,
  }));
  await evaluate(() => window.scrollTo(0, 0));
  const beforeMove = await boardLocation();
  const materialReply = await play('e2', 'e4', 2, 'material');
  await waitFor('both confirmed moves to play audio', async () => (await evaluate(() => window.playedClips)) === 3);
  await delay(350);
  assert.deepEqual(await boardLocation(), beforeMove, 'Playing a move should not shift the board or scroll the page');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1360, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await delay(100);
  assert.equal(materialReply.lastSearch.depth, 1);
  await screenshot('material-white');
  await evaluate(() => {
    const measure = () => [
      window.scrollX,
      document.querySelector('[data-square="a8"]').getBoundingClientRect().left,
    ];
    window.boardMeasurements = [measure()];
    const observer = new MutationObserver(() => window.boardMeasurements.push(measure()));
    observer.observe(document.querySelector('main'), { subtree: true, childList: true, characterData: true });
    window.stopBoardMeasurement = () => observer.disconnect();
  });
  const second = new Chess(materialReply.fen).moves({ verbose: true })[0];
  await play(second.from, second.to, 4, 'material');
  const positions = await evaluate(() => {
    window.stopBoardMeasurement();
    return window.boardMeasurements;
  });
  assert.ok(positions.length > 1);
  for (const position of positions) assert.deepEqual(position, positions[0], 'Changing turns should keep the board horizontally fixed');
  const undoMaterial = snapshot();
  await click('Undo move');
  assert.equal((await gameRequest('undo', undoMaterial)).fen, materialReply.fen);
  await waitForText('2 plies');
  const liveRevision = (await getJson(gamePath)).revision;
  await click('Previous position');
  await waitForText('Reviewing position');
  await click('Previous position');
  await waitFor('the starting position', async () => evaluate(() =>
    document.querySelector('[data-square="e2"] [data-piece="wP"]') !== null));
  await click('Next position');
  await waitFor('the first move on the board', async () => evaluate(() =>
    document.querySelector('[data-square="e4"] [data-piece="wP"]') !== null));
  await click('Next position');
  await waitFor('live game after review', async () => !(await pageHas('Reviewing position')));
  assert.equal((await getJson(gamePath)).revision, liveRevision);
  const beforeRefresh = snapshot();
  await send('Page.reload');
  await delay(500);
  await waitForText('2 plies');
  assert.equal(await pageHas('Begin Match'), false);
  assert.equal((await getJson(gamePath)).revision, liveRevision);
  assert.ok(![...requests].some(([id, request]) => !beforeRefresh.has(id) && request.path === '/games'));


  const neuralStart = await startMatch('black', 'neural');
  const neuralOpening = await gameRequest('engine-move', neuralStart);
  const standalone = await getJson('/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen: neuralOpening.initialFen, evaluationMode: 'neural', maxDepth: 1 }),
  });
  assert.equal(neuralOpening.moveHistory.length, 1);
  assert.equal(neuralOpening.moveHistory[0].uci, standalone.move);
  assert.equal(neuralOpening.lastSearch.scoreCp, standalone.scoreCp);
  assert.equal(neuralOpening.turn, 'b');
  await waitForText('1 ply');
  await play('e7', 'e5', 3, 'neural');
  await screenshot('neural-black');
  const undoNeural = snapshot();
  await click('Undo move');
  assert.equal((await gameRequest('undo', undoNeural)).fen, neuralOpening.fen);
  await waitForText('1 ply');

  await monitorAudio();
  await click('Analysis');
  await click('Ruy López');
  assert.ok(await select('select[aria-label="Evaluation mode"]', 'neural'));
  const analysisStart = snapshot();
  await click('Analyze Position');
  const [analysisId, analysisRequest] = await requestSince('/analyze', analysisStart);
  assert.equal(analysisRequest.status, 200);
  const analysis = JSON.parse((await send('Network.getResponseBody', { requestId: analysisId })).body);
  assert.equal(analysis.evaluationMode, 'neural');
  await waitForText(`${analysis.san} (${analysis.move})`);
  const hasArrow = () => evaluate(() => Boolean(document.querySelector('line[stroke="#39b1a0"]')));
  await waitFor('the best-move arrow', hasArrow);
  await click('Flip');
  await waitFor('the arrow on the flipped board', hasArrow);
  await clickWithMouse('Play best move');
  await waitFor('the old arrow to clear', async () => !(await hasArrow()));
  await waitFor('analysis move sound', async () => (await evaluate(() => window.playedClips)) === 1);
  const analysisFen = await evaluate(() => document.querySelector('#fen-input').value);

  assert.equal((await getJson(gamePath)).fen, neuralOpening.fen);
  await screenshot('analysis-neural');

  await click('Play');
  await waitForText('1 ply');
  await click('Import position from FEN');
  assert.ok(await select('input[placeholder^="rnbqkbnr"]', 'invalid'));
  await click('Load Board');
  await waitForText('Invalid FEN');
  await click('Cancel');
  await waitFor('the FEN form error to clear', async () => !(await pageHas('Invalid FEN')));
  await send('Page.reload');
  await delay(500);
  await waitForText('1 ply');
  await click('Analysis');
  await waitFor('the saved analysis board', () => evaluate((fen) =>
    document.querySelector('#fen-input')?.value === fen, analysisFen));
  await click('Play');
  await waitForText('1 ply');

  async function checkPromotionDialog() {
    await waitFor('the promotion chooser', () => evaluate(() =>
      Boolean(document.querySelector('dialog:modal'))));
    const options = await evaluate(() => [...document.querySelectorAll('dialog:modal button')]
      .filter((button) => button.textContent.trim() !== 'Cancel')
      .map((button) => {
        const { left, right, top, bottom, width, height } = button.getBoundingClientRect();
        return {
          name: button.querySelector('span:last-child').textContent,
          reachable: left >= 0 && right <= innerWidth && top >= 0 && bottom <= innerHeight &&
            width >= 44 && height >= 44 &&
            button.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)),
        };
      }));
    assert.deepEqual(options, ['Queen', 'Rook', 'Bishop', 'Knight']
      .map((name) => ({ name, reachable: true })));
  }

  await click('Import position from FEN');
  assert.ok(await select('input[placeholder^="rnbqkbnr"]', '4k3/p7/8/8/8/8/7p/4K3 b - - 0 1'));
  const beforeImport = snapshot();
  await click('Load Board');
  await gameRequest('reset', beforeImport);
  await waitFor('the pawn on h2 to be draggable', () => evaluate(() => {
    const pawn = document.querySelector('[data-square="h2"] [data-piece="bP"][draggable="true"]');
    if (!pawn) return false;
    const { x, y, width, height } = pawn.getBoundingClientRect();
    return pawn.contains(document.elementFromPoint(x + width / 2, y + height / 2));
  }));
  const beforePromotion = snapshot();
  await evaluate(() => {
    const pawn = document.querySelector('[data-square="h2"] [data-piece="bP"]');
    const target = document.querySelector('[data-square="h1"]');
    const dataTransfer = new DataTransfer();
    const dispatch = (element, type) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      element.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, dataTransfer,
        clientX: x + width / 2, clientY: y + height / 2,
      }));
    };
    dispatch(pawn, 'dragstart');
    for (const type of ['dragenter', 'dragover', 'drop']) dispatch(target, type);
    dispatch(pawn, 'dragend');
  });
  await checkPromotionDialog();
  await screenshot('promotion-desktop');
  await clickWithMouse('Knight');
  const promoted = await gameRequest('moves', beforePromotion);
  assert.equal(promoted.moveHistory[0].uci, 'h2h1n');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await screenshot('play-mobile');
  await click('Analysis');
  const promotionFen = '4k3/7P/8/8/8/8/P7/4K3 w - - 0 1';
  await waitFor('the Analysis FEN input', () => select('#fen-input', promotionFen));
  await click('Load');
  await waitFor('the pawn on h7', () => evaluate(() =>
    Boolean(document.querySelector('[data-square="h7"] [data-piece="wP"]'))));
  await square('h7');
  await square('g8');
  assert.ok(await evaluate(() => !document.querySelector('dialog:modal')));
  await square('h7');
  await square('h8');
  await checkPromotionDialog();
  await screenshot('promotion-mobile');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor('promotion cancellation', () => evaluate(() => !document.querySelector('dialog:modal')));
  assert.equal(await evaluate(() => document.querySelector('#fen-input').value), promotionFen);
  await square('h7');
  await square('h8');
  await checkPromotionDialog();
  await clickWithMouse('Rook');
  await waitFor('the promoted rook', () => evaluate(() =>
    Boolean(document.querySelector('[data-square="h8"] [data-piece="wR"]'))));
  assert.deepEqual(exceptions, []);
}

async function main() {
  await getJson('/health');
  const profile = mkdtempSync(join(tmpdir(), 'neurachess-chrome-'));
  const chrome = spawn(process.env.CHROME_BIN || 'google-chrome-stable', [
    '--headless', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let chromeError;
  chrome.on('error', (error) => { chromeError = error; });
  let client;
  try {
    const portFile = join(profile, 'DevToolsActivePort');
    const port = await waitFor('Chrome DevTools', () => {
      if (chromeError) throw chromeError;
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
      return existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n')[0];
    });
    client = await connect(port);
    await verifyGameplay(client);
  } finally {
    if (client) {
      await Promise.race([client.send('Browser.close').catch(() => {}), delay(1000)]);
    }
    client?.socket.close();
    if (chrome.pid && chrome.exitCode === null && chrome.signalCode === null) {
      await new Promise((resolve) => {
        chrome.once('exit', resolve);
        chrome.kill();
      });
    }
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if (error.code !== 'ENOTEMPTY' && error.code !== 'EBUSY') throw error;
      console.warn(`Chrome left temporary files in ${profile}.`);
    }
  }
  console.log('Browser checks passed for Material as White, Neural as Black, analysis, history review, undo, reset, invalid FEN, and desktop and mobile promotion.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
