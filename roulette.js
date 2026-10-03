'use strict';

// お題を追加する場合はこの配列へ。改行は \n。外観は共通の月面・単一アクセントです。
const topics = [
  { id: 1, text: '片方だけの靴下を\n1,000円で売ってください', planetType: 'blue', accentColor: '#E8A84C' },
  { id: 2, text: '石ころを\n1,000円で売ってください', planetType: 'purple', accentColor: '#E8A84C' },
  { id: 3, text: '宇宙人に地球のお土産を\nひとつ紹介してください', planetType: 'orange', accentColor: '#E8A84C' },
  { id: 4, text: '月にオープンするカフェの\n名前を考えてください', planetType: 'white', accentColor: '#E8A84C' },
  { id: 5, text: '無重力で楽しめる\n新しいスポーツを考えてください', planetType: 'ringed', accentColor: '#E8A84C' },
  { id: 6, text: '100年後の自分へ\nメッセージを送ってください', planetType: 'glow', accentColor: '#E8A84C' },
  { id: 7, text: '月面基地の\n名前を考えてください', planetType: 'blue', accentColor: '#E8A84C' },
  { id: 8, text: '宇宙旅行に持っていく\nひとつを選んでください', planetType: 'purple', accentColor: '#E8A84C' },
  { id: 9, text: '未来の学校にある\n授業を考えてください', planetType: 'orange', accentColor: '#E8A84C' },
  { id: 10, text: '地球をひとことで\n紹介してください', planetType: 'white', accentColor: '#E8A84C' },
];
const MAX_TOPIC_COUNT = 10;
const stage = document.querySelector('#stage');
const planet = document.querySelector('#planet');
const topicElement = document.querySelector('#topic');
const startButton = document.querySelector('#start');
const topicChoice = document.querySelector('#topic-choice');
const topicCount = document.querySelector('#topic-count');
const avoidCount = document.querySelector('#avoid-count');
const topicText = document.querySelector('#topic-text');
const saveTopicButton = document.querySelector('#save-topic');
const controls = document.querySelector('#controls');
const canvas = document.querySelector('#warp');
const ctx = canvas.getContext('2d');
let selectedTopic = null;
let chosenTopicId = 'random';
let topicTextOverrides = {};
let topicPoolSize = topics.length;
let repeatAvoidCount = 0;
let recentTopicIds = [];
let phase = 'idle';
let timers = new Set();
let animationFrame = null;
let runId = 0;
let hintTimer;

// ドアと外枠を初回だけオフスクリーンで切り抜き、毎フレームは画像3枚だけを合成。
const hatchCanvas = document.querySelector('#hatch');
const hatchContext = hatchCanvas.getContext('2d');
const hatchImage = new Image();
const hatchSpaceImage = new Image();
let hatchReady = false;
let hatchProgress = 0;
let hatchFullyOpen = false;
let hatchAnimationFrame = null;
let hatchLayers = [];
startButton.disabled = true;

try {
  topicTextOverrides = JSON.parse(localStorage.getItem('space-topic-texts') || '{}');
} catch {
  topicTextOverrides = {};
}
topicPoolSize = Math.max(1, Math.min(MAX_TOPIC_COUNT, topics.length, Number(localStorage.getItem('space-topic-count')) || topics.length));
repeatAvoidCount = Math.max(0, Math.min(4, Number(localStorage.getItem('space-avoid-count')) || 0));
try {
  recentTopicIds = JSON.parse(localStorage.getItem('space-topic-history') || '[]');
  if (!Array.isArray(recentTopicIds)) recentTopicIds = [];
} catch {
  recentTopicIds = [];
}
for (const topic of topics) {
  if (typeof topicTextOverrides[topic.id] === 'string' && topicTextOverrides[topic.id].trim()) {
    topic.text = topicTextOverrides[topic.id];
  }
}

// スタッフ用の選択肢。表示名は改行を除いた本文で読みやすくします。
for (const topic of topics) {
  const option = document.createElement('option');
  option.value = String(topic.id);
  option.textContent = `${topic.id}. ${topic.text.replace(/\n/g, ' / ')}`;
  topicChoice.append(option);
}
for (let count = 1; count <= MAX_TOPIC_COUNT; count += 1) {
  const option = document.createElement('option');
  option.value = String(count);
  option.textContent = count === MAX_TOPIC_COUNT ? `全${count}題` : `${count}題`;
  topicCount.append(option);
}
for (let count = 0; count <= 4; count += 1) {
  const option = document.createElement('option');
  option.value = String(count);
  option.textContent = count === 0 ? 'なし' : `${count}回`;
  avoidCount.append(option);
}
topicCount.value = String(topicPoolSize);
avoidCount.value = String(repeatAvoidCount);
function topicOptionLabel(topic) {
  return `${topic.id}. ${topic.text.replace(/\n/g, ' / ')}`;
}
function syncTopicEditor() {
  const selected = topics.find(topic => String(topic.id) === topicChoice.value);
  const editable = phase === 'idle' && Boolean(selected);
  topicText.disabled = !editable;
  saveTopicButton.disabled = !editable;
  topicText.value = selected?.text || '';
}
function syncTopicSettingsState() {
  const editable = phase === 'idle';
  topicCount.disabled = !editable;
  avoidCount.disabled = !editable;
  topicChoice.disabled = !editable;
  syncTopicEditor();
}
function chooseRandomTopic() {
  const pool = topics.slice(0, topicPoolSize);
  const blocked = new Set(recentTopicIds.slice(-repeatAvoidCount));
  const candidates = pool.filter(topic => !blocked.has(topic.id));
  const source = candidates.length ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}
function rememberTopic(topic) {
  recentTopicIds.push(topic.id);
  recentTopicIds = recentTopicIds.slice(-4);
  localStorage.setItem('space-topic-history', JSON.stringify(recentTopicIds));
}

function hatchOpeningPath(context, width, height) {
  context.beginPath();
  context.moveTo(width * .25, height * .77);
  context.lineTo(width * .21, height * .62);
  context.bezierCurveTo(width * .20, height * .43, width * .31, height * .205, width * .50, height * .205);
  context.bezierCurveTo(width * .69, height * .205, width * .80, height * .43, width * .79, height * .62);
  context.lineTo(width * .75, height * .77);
  context.closePath();
}
function prepareHatchLayers() {
  const width = Math.min(1920, Math.round(stage.clientWidth * Math.min(devicePixelRatio || 1, 2)));
  const height = Math.round(width * 9 / 16);
  if (hatchCanvas.width === width && hatchLayers.length) return;
  hatchCanvas.width = width;
  hatchCanvas.height = height;
  hatchLayers = ['left', 'right', 'frame'].map(part => {
    const layer = document.createElement('canvas');
    layer.width = width; layer.height = height;
    const context = layer.getContext('2d');
    if (part !== 'frame') {
      hatchOpeningPath(context, width, height); context.clip();
      context.beginPath();
      // 奇数幅でも中央にアンチエイリアスの隙間が出ないよう1px重ねます。
      context.rect(part === 'left' ? 0 : width / 2 - 1, 0, width / 2 + 1, height);
      context.clip();
    }
    context.drawImage(hatchImage, 0, 0, width, height);
    if (part === 'frame') {
      context.globalCompositeOperation = 'destination-out';
      hatchOpeningPath(context, width, height); context.fill();
    }
    return layer;
  });
  drawHatch(hatchProgress);
}
function drawHatch(progress) {
  const width = hatchCanvas.width, height = hatchCanvas.height;
  // 宇宙を先に直接描く。透過先や閉じた背景画像に依存させない。
  hatchContext.drawImage(hatchSpaceImage, 0, 0, width, height);
  hatchContext.fillStyle = 'rgba(16, 27, 53, .25)';
  hatchContext.fillRect(0, 0, width, height);
  // 全開後は扉を描画しない。リサイズや発進でも閉じた画像を戻さない。
  if (!hatchFullyOpen && progress < 1) {
    const travel = width * .34 * progress;
    hatchContext.drawImage(hatchLayers[0], -travel, 0);
    hatchContext.drawImage(hatchLayers[1], travel, 0);
  }
  hatchContext.drawImage(hatchLayers[2], 0, 0);
}
function animateHatchOpen() {
  const currentRun = runId;
  let started;
  function frame(now) {
    if (currentRun !== runId) return;
    started ??= now;
    const t = Math.min((now - started) / 1200, 1);
    hatchProgress = t * t * (3 - 2 * t);
    if (t === 1) hatchFullyOpen = true;
    drawHatch(hatchProgress);
    if (t < 1) hatchAnimationFrame = requestAnimationFrame(frame);
    else {
      hatchAnimationFrame = null;
      setPhase('hatch-open');
      schedule(launch, 450);
    }
  }
  hatchAnimationFrame = requestAnimationFrame(frame);
}
function initializeHatch() {
  if (!hatchImage.complete || !hatchImage.naturalWidth
    || !hatchSpaceImage.complete || !hatchSpaceImage.naturalWidth) return;
  hatchReady = true;
  prepareHatchLayers();
  startButton.disabled = phase !== 'idle';
}
hatchImage.onload = initializeHatch;
hatchSpaceImage.onload = initializeHatch;
hatchImage.onerror = hatchSpaceImage.onerror = () => showHint('背景画像を読み込めません。assetsフォルダを確認してください。');
hatchImage.src = 'assets/space-ship-interior.png';
hatchSpaceImage.src = 'assets/space-deep-space.png';

// 24個の控えめな背景の星。ワープの光線とは独立させています。
for (let i = 0; i < 24; i++) {
  const star = document.createElement('i');
  star.className = 'star';
  star.style.cssText = `left:${(i * 37.7 + 9) % 100}%;top:${(i * 23.3 + 7) % 100}%;--size:${1 + i % 3}px;--opacity:${.15 + (i % 4) * .09}`;
  document.querySelector('#stars').append(star);
}
function setPhase(next) { phase = next; stage.dataset.phase = next; }
function schedule(callback, delay) {
  const currentRun = runId;
  const timer = setTimeout(() => { timers.delete(timer); if (currentRun === runId) callback(); }, delay);
  timers.add(timer);
}
function flash() {
  const element = document.querySelector('.flash');
  element.classList.remove('pulse');
  void element.offsetWidth;
  element.classList.add('pulse');
}
function startRoulette() {
  if (phase !== 'idle' || !topics.length || !hatchReady) return;
  // 選択中のお題を開始時に一度だけ固定。演出中は再抽選しません。
  const chosen = chosenTopicId === 'random'
    ? chooseRandomTopic()
    : topics.find(topic => String(topic.id) === chosenTopicId) ?? topics[0];
  selectedTopic = { ...chosen };
  rememberTopic(chosen);
  startButton.disabled = true;
  planet.className = `planet ${selectedTopic.planetType}`;
  planet.style.setProperty('--accent', selectedTopic.accentColor);
  setPhase('prepare');
  syncTopicSettingsState();
  stage.classList.add('prepared-sides');
  schedule(() => stage.classList.add('prepared-center'), 300);
  schedule(() => stage.classList.add('prepared-rim'), 650);
  schedule(openLaunchHatch, 950);
}
function openLaunchHatch() {
  setPhase('opening');
  animateHatchOpen();
}
function launch() {
  if (!hatchFullyOpen || hatchProgress !== 1 || phase !== 'hatch-open') return;
  drawHatch(1);
  setPhase('launch');
  stage.classList.add('departing');
  animateWarp();
  // ドアの実際の描画完了から後続の演出を開始します。
  schedule(startWarp, 1100);
  schedule(showPlanet, 3400);
  schedule(arrivePlanet, 6150);
  schedule(settleOnMoon, 6750);
  schedule(showTopic, 7250);
}
function startWarp() { setPhase('warp'); stage.classList.add('in-flight'); }
function showPlanet() {
  setPhase('approach');
  // 光の尾を減速させてから消し、月への接近につなげます。
  schedule(stopWarp, 700);
  stage.classList.add('planet-visible');
  schedule(() => stage.classList.add('planet-near'), 60);
}
function arrivePlanet() {
  setPhase('arrival');
  stage.classList.add('on-moon');
  stage.classList.remove('planet-visible');
}
function settleOnMoon() {
  // 着陸のクロスフェード完了後、月面を0.5秒静止して見せます。
  setPhase('landed');
}
function showTopic() {
  // textContentを使い、お題文字列をHTMLとして解釈しません。
  topicElement.replaceChildren();
  const parts = selectedTopic.text.split(/(\d[\d,]*円|\n)/g);
  for (const part of parts) {
    if (part === '\n') topicElement.append(document.createElement('br'));
    else if (/^\d[\d,]*円$/.test(part)) {
      const mark = document.createElement('mark'); mark.textContent = part; topicElement.append(mark);
    } else topicElement.append(document.createTextNode(part));
  }
  setPhase('result');
  fitTopic();
}
function fitTopic() {
  if (phase !== 'result') return;
  const panel = document.querySelector('#result');
  const label = document.querySelector('.result-label');
  const panelStyle = getComputedStyle(panel);
  const availableHeight = panel.clientHeight - parseFloat(panelStyle.paddingTop)
    - parseFloat(panelStyle.paddingBottom) - label.offsetHeight
    - parseFloat(getComputedStyle(label).marginBottom);
  let size = stage.clientWidth * .052;
  topicElement.style.fontSize = `${size}px`;
  // パネルの実寸に合わせて最大3行に収めます。
  while ((topicElement.scrollHeight > Math.min(size * 1.22 * 3 + 2, availableHeight)
    || topicElement.scrollWidth > topicElement.clientWidth + 2) && size > 12) {
    size -= 1;
    topicElement.style.fontSize = `${size}px`;
  }
}
function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(stage.clientWidth * ratio);
  canvas.height = Math.round(stage.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  fitTopic();
  if (hatchReady) prepareHatchLayers();
}
// 18本の光線と5層の薄い光の波。中央は空け、奥から手前への移動を描きます。
function animateWarp() {
  stopWarp();
  const started = performance.now();
  let previous = started;
  let distanceTravelled = 0;
  let brakingAt = null;
  function draw(now) {
    const w = stage.clientWidth, h = stage.clientHeight;
    const elapsed = (now - started) / 1000;
    const delta = Math.min((now - previous) / 1000, .05);
    previous = now;
    if (phase === 'approach' && brakingAt === null) brakingAt = now;
    const braking = brakingAt === null ? 1 : Math.max(0, 1 - (now - brakingAt) / 700);
    const acceleration = Math.min(1, elapsed / .9);
    distanceTravelled += delta * (.35 + acceleration * 1.1) * Math.max(.08, braking);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = braking;
    ctx.globalCompositeOperation = 'screen';
    const cx = w * .5, cy = h * .47;
    const unit = w / 1920;

    // 幅の広い、淡い光の波。輪郭を重ねて厚みを作り、HUDの輪にはしません。
    for (let layer = 0; layer < 5; layer++) {
      const depth = (distanceTravelled * .32 + layer / 5) % 1;
      const radius = w * (.045 + depth * depth * .85);
      const alpha = Math.sin(depth * Math.PI) * .065 * acceleration;
      for (let band = 0; band < 3; band++) {
        ctx.strokeStyle = `rgba(169,190,215,${alpha / (band + 1)})`;
        ctx.lineWidth = (3 + band * 13) * unit * depth;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * .64, -.08, .22, 2.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * .64, -.08, 3.4, 6.0);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 18; i++) {
      const angle = i * Math.PI * 2 / 18 + Math.sin(i * 7.3) * .1;
      const depth = (distanceTravelled * (.65 + (i % 3) * .11) + i * .173) % 1;
      const perspective = depth * depth * depth;
      const radius = w * (.055 + perspective * .76);
      const length = w * (.016 + perspective * .33) * (.25 + acceleration * .75) * Math.max(.12, braking);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * .7;
      const endX = cx + Math.cos(angle) * (radius + length);
      const endY = cy + Math.sin(angle) * (radius + length) * .7;
      const alpha = Math.min(1, depth * 2) * .85;
      const gradient = ctx.createLinearGradient(x, y, endX, endY);
      gradient.addColorStop(0, 'rgba(180,202,229,0)');
      gradient.addColorStop(.75, `rgba(188,207,229,${alpha * .45})`);
      gradient.addColorStop(1, `rgba(242,245,250,${alpha})`);
      ctx.strokeStyle = gradient;
      ctx.lineCap = 'round';
      // 広い残光と細い芯を同じ軌道で描きます。
      for (const [width, opacity] of [[15, .08], [5, .22], [1.5, 1]]) {
        ctx.globalAlpha = braking * opacity;
        ctx.lineWidth = (1 + perspective * width) * unit;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.stroke();
      }
    }
    ctx.restore();
    animationFrame = requestAnimationFrame(draw);
  }
  animationFrame = requestAnimationFrame(draw);
}
function stopWarp() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
}
function resetSystem() {
  runId++;
  cancelAnimationFrame(hatchAnimationFrame);
  hatchAnimationFrame = null;
  hatchProgress = 0;
  hatchFullyOpen = false;
  if (hatchReady) drawHatch(0);
  timers.forEach(clearTimeout); timers.clear(); stopWarp();
  selectedTopic = null;
  // リセット時はトランジションも即座に取り消し、途中状態を残しません。
  stage.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  stage.className = 'resetting';
  planet.className = 'planet blue';
  planet.removeAttribute('style');
  topicElement.replaceChildren(); topicElement.removeAttribute('style');
  document.querySelector('.flash').classList.remove('pulse');
  setPhase('idle'); startButton.disabled = !hatchReady;
  syncTopicSettingsState();
  clearTimeout(hintTimer); document.querySelector('#hint').textContent = '';
  void stage.offsetWidth; stage.classList.remove('resetting');
}
function showHint(message) {
  clearTimeout(hintTimer);
  document.querySelector('#hint').textContent = message;
  hintTimer = setTimeout(() => document.querySelector('#hint').textContent = '', 2400);
}
function toggleControls() {
  const hidden = controls.classList.toggle('hidden');
  if (hidden) { document.activeElement.blur(); showHint('H キーで操作パネルを表示'); }
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { showHint('ブラウザのメニューから全画面表示に切り替えてください'); }
}
startButton.addEventListener('click', startRoulette);
topicChoice.addEventListener('change', () => {
  if (phase !== 'idle') return;
  chosenTopicId = topicChoice.value;
  syncTopicEditor();
  const selected = chosenTopicId === 'random' ? null : topics.find(topic => String(topic.id) === chosenTopicId);
  showHint(selected ? `選択中：お題 ${selected.id}` : '選択中：ランダム');
});
topicCount.addEventListener('change', () => {
  if (phase !== 'idle') return;
  topicPoolSize = Number(topicCount.value);
  localStorage.setItem('space-topic-count', String(topicPoolSize));
  showHint(`ランダム対象：${topicPoolSize === topics.length ? '全お題' : `${topicPoolSize}題`}`);
});
avoidCount.addEventListener('change', () => {
  if (phase !== 'idle') return;
  repeatAvoidCount = Number(avoidCount.value);
  localStorage.setItem('space-avoid-count', String(repeatAvoidCount));
  showHint(repeatAvoidCount ? `同じお題を直近${repeatAvoidCount}回避けます` : '連続回避なし');
});
saveTopicButton.addEventListener('click', () => {
  if (phase !== 'idle') return;
  const selected = topics.find(topic => String(topic.id) === topicChoice.value);
  const value = topicText.value.replace(/\r\n/g, '\n').trim();
  if (!selected || !value) {
    showHint('お題本文を入力してください');
    return;
  }
  selected.text = value;
  topicTextOverrides[selected.id] = value;
  localStorage.setItem('space-topic-texts', JSON.stringify(topicTextOverrides));
  const option = topicChoice.querySelector(`option[value="${selected.id}"]`);
  if (option) option.textContent = topicOptionLabel(selected);
  topicText.value = selected.text;
  showHint(`お題 ${selected.id} を保存しました`);
});
document.querySelector('#reset').addEventListener('click', resetSystem);
document.querySelector('#hide').addEventListener('click', toggleControls);
document.querySelector('#fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', event => {
  // ルーレット画面から管理者画面へ戻るショートカット（Mac：⌘ + Space）。
  if (event.metaKey && event.code === 'Space') {
    event.preventDefault();
    window.location.href = '/admin';
    return;
  }
  // 本番表示（操作パネル非表示）ではEnterだけで進行できます。
  if (event.code === 'Enter' && !event.repeat && controls.classList.contains('hidden')) {
    event.preventDefault();
    if (phase === 'idle') startRoulette();
    else if (phase === 'result') resetSystem();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) startRoulette(); }
  else if (!event.repeat && event.key.toLowerCase() === 'r') resetSystem();
  else if (!event.repeat && event.key.toLowerCase() === 'h') toggleControls();
  else if (!event.repeat && event.key.toLowerCase() === 'f') toggleFullscreen();
});
new ResizeObserver(resizeCanvas).observe(stage);
resizeCanvas();
syncTopicSettingsState();
