/* =========================================================
   午餐抽奖转盘
   说明：纯前端演示项目，账号数据保存在浏览器 localStorage 中，
   仅供学习/娱乐使用，请勿用于生产环境（明文哈希，非加密安全）。
   ========================================================= */

// ---------- 常量 ----------
const USERS_KEY = 'lucky_users';     // 所有账号 {用户名: {pw, createdAt, history[]}}
const SESSION_KEY = 'lucky_session'; // 当前登录的用户名

const FOODS = [
  '辣子鸡套餐', '土豆肉片盖饭', '抄手', '水果套餐', 'BBQ',
  '塔斯汀', '小炒', '烤鱼', '蛙火锅'
];

// 扫动路径：外圈绕行 + 中心，共 9 格
const PATH = [0, 1, 2, 5, 8, 7, 6, 3, 4];

// ---------- 存储工具 ----------
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function getSession() {
  return localStorage.getItem(SESSION_KEY);
}
function setSession(name) {
  localStorage.setItem(SESSION_KEY, name);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// 简单密码散列（演示用，不是加密安全算法）
function hashPassword(pw) {
  let h = 5381;
  const salted = 'lunch@' + pw;
  for (let i = 0; i < salted.length; i++) {
    h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ---------- 元素引用 ----------
const authView     = document.getElementById('auth-view');
const gameView     = document.getElementById('game-view');
const panelLottery = document.getElementById('panel-lottery');
const panelScratch = document.getElementById('panel-scratch');
const gameTabs     = document.querySelectorAll('.game-tab');
const authTitle    = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authForm     = document.getElementById('auth-form');
const usernameInput= document.getElementById('username');
const passwordInput= document.getElementById('password');
const confirmInput = document.getElementById('confirm');
const passwordField= document.getElementById('password-field');
const confirmField = document.getElementById('confirm-field');
const authSubmit   = document.getElementById('auth-submit');
const authToggle   = document.getElementById('auth-toggle');
const authSwitchText = document.getElementById('auth-switch-text');
const authError    = document.getElementById('auth-error');
const logoutBtn    = document.getElementById('logout-btn');
const currentUserEl= document.getElementById('current-user');
const wheelEl      = document.getElementById('wheel');
const cells        = document.querySelectorAll('.cell');
const drawBtn      = document.getElementById('draw-btn');
const resultEl     = document.getElementById('result');
const historyList  = document.getElementById('history-list');

// ---------- 登录 / 注册切换 ----------
let mode = 'login'; // 'login' | 'register'

function renderAuthMode() {
  const isRegister = mode === 'register';
  authTitle.textContent      = isRegister ? '创建账号' : '欢迎回来';
  authSubtitle.textContent   = isRegister ? '注册后就能开始抽奖啦 🎡' : '登录后开启你的午餐抽奖之旅';
  confirmField.style.display = isRegister ? '' : 'none';
  authSubmit.textContent     = isRegister ? '注 册' : '登 录';
  authSwitchText.textContent = isRegister ? '已有账号？' : '还没有账号？';
  authToggle.textContent     = isRegister ? '去登录' : '立即注册';
  hideError();
}

authToggle.addEventListener('click', (e) => {
  e.preventDefault();
  mode = mode === 'login' ? 'register' : 'login';
  confirmInput.value = '';
  authForm.reset();
  renderAuthMode();
});

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}
function hideError() {
  authError.style.display = 'none';
}

// ---------- 表单提交 ----------
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const users = getUsers();

  if (mode === 'register') {
    const confirm = confirmInput.value;
    if (username.length < 2 || username.length > 16) {
      return showError('用户名长度需在 2~16 个字符之间');
    }
    if (/\s/.test(username)) {
      return showError('用户名不能包含空格');
    }
    if (users[username]) {
      return showError('该用户名已被注册，换个试试吧');
    }
    if (password.length < 6) {
      return showError('密码至少需要 6 位');
    }
    if (password !== confirm) {
      return showError('两次输入的密码不一致');
    }

    users[username] = {
      pw: hashPassword(password),
      createdAt: Date.now(),
      history: []
    };
    saveUsers(users);
    setSession(username);
    enterGame();
  } else {
    if (!users[username]) {
      return showError('该用户名不存在，请先注册');
    }
    if (users[username].pw !== hashPassword(password)) {
      return showError('密码错误，请重试');
    }
    setSession(username);
    enterGame();
  }
});

// ---------- 进入 / 退出 ----------
function enterGame() {
  const user = getSession();
  currentUserEl.textContent = user;
  authView.style.display    = 'none';
  gameView.style.display    = 'flex';
  authForm.reset();
  hideError();
  switchGame('lottery');
  resetWheel();
  renderHistory();
  initScratch();
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  mode = 'login';
  renderAuthMode();
  authForm.reset();
  gameView.style.display = 'none';
  authView.style.display = 'flex';
});

// ---------- 游戏切换 ----------
function switchGame(name) {
  gameTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  panelLottery.style.display = name === 'lottery' ? '' : 'none';
  panelScratch.style.display = name === 'scratch' ? '' : 'none';
}

gameTabs.forEach(t => t.addEventListener('click', () => switchGame(t.dataset.tab)));

function resetWheel() {
  cells.forEach(c => c.classList.remove('running', 'winner'));
  resultEl.style.display = 'none';
}

// ---------- 抽奖逻辑 ----------
let spinning = false;

drawBtn.addEventListener('click', () => {
  if (spinning) return;
  spin();
});

function spin() {
  spinning = true;
  drawBtn.disabled = true;
  resetWheel();

  // 等概率抽取：0~8 各占 1/9
  const winner    = Math.floor(Math.random() * 9);
  const targetPos = PATH.indexOf(winner); // 目标在路径中的位置（0~8）

  // 先转 2~4 整圈，再准确停在目标格
  const loops      = 2 + Math.floor(Math.random() * 3);
  const totalSteps = loops * 9 + targetPos + 1;

  const baseDelay = 70;   // 起始速度（毫秒）
  const maxDelay  = 360;  // 最慢速度
  let step = 0;
  let currentPos = -1;

  function tick() {
    step++;
    currentPos++;
    const cellIdx = PATH[currentPos % 9];

    cells.forEach(c => c.classList.remove('running'));
    cells[cellIdx].classList.add('running');

    if (step >= totalSteps) {
      setTimeout(() => finish(winner), 150); // 停顿一下再揭晓
      return;
    }

    // 减速效果：t 从 0→1，间隔逐渐变大
    const t = step / totalSteps;
    const delay = baseDelay + (maxDelay - baseDelay) * Math.pow(t, 3);
    setTimeout(tick, delay);
  }
  tick();
}

function finish(winner) {
  const winCell = cells[winner];
  winCell.classList.add('winner');
  cells.forEach(c => c.classList.remove('running'));

  const name = FOODS[winner];
  resultEl.style.display = 'block';
  resultEl.innerHTML = `🎉 恭喜抽中了：<strong>${name}</strong>！`;

  // 记录抽奖历史
  const user = getSession();
  const users = getUsers();
  const record = user ? users[user] : null;
  if (record) {
    record.history = record.history || [];
    record.history.push({ food: name, time: new Date().toLocaleString('zh-CN') });
    saveUsers(users);
    renderHistory();
  }

  confetti();
  spinning = false;
  drawBtn.disabled = false;
}

// ---------- 抽奖记录 ----------
function renderHistory() {
  const users = getUsers();
  const hist = (getSession() && users[getSession()] && users[getSession()].history) || [];
  historyList.innerHTML = '';

  if (!hist.length) {
    historyList.innerHTML = '<li class="history-empty">还没有记录，快去抽一个吧～</li>';
    return;
  }

  [...hist].reverse().forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${r.food}</span>` +
      `<span style="color:rgba(255,255,255,.5);font-size:12px;">${r.time}</span>`;
    historyList.appendChild(li);
  });
}

// ---------- 彩带效果 ----------
function confetti() {
  const colors = ['#ff6b35', '#ffb020', '#30a46c', '#4cc2ff', '#ff5d8f', '#b388ff'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    el.style.animationDelay = (Math.random() * 0.3) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

// ---------- 刮刮乐 ----------
const scratchCanvas  = document.getElementById('scratch-canvas');
const scratchPrizeEl = document.getElementById('scratch-prize');
const scratchNewBtn  = document.getElementById('scratch-new');
const scratchResult  = document.getElementById('scratch-result');
const scratchCtx     = scratchCanvas.getContext('2d');
const payGate        = document.getElementById('pay-gate');
const scratchPlay    = document.getElementById('scratch-play');
const payConfirmBtn  = document.getElementById('pay-confirm');

let prizeAmount    = 0;      // 当前卡片的中奖金额
let scratchRevealed = false; // 是否已揭晓
let scratchActive  = false;  // 是否正在刮
let scratchLast    = null;   // 上一次刮的位置（连成线条）
let scratchInited  = false;
let scratchCheckTick = 0;

function initScratch() {
  if (scratchInited) return;
  scratchInited = true;
  bindScratchEvents();
  lockScratch(); // 初始状态：先付款再刮
}

// 锁定：显示支付门，隐藏刮卡区
function lockScratch() {
  scratchRevealed = true; // 防止未付款还能刮
  scratchResult.style.display = 'none';
  payGate.style.display = '';
  scratchPlay.style.display = 'none';
}

// 付款确认后解锁：隐藏支付门，发新卡
function unlockScratch() {
  payGate.style.display = 'none';
  scratchPlay.style.display = '';
  newScratchCard();
}

// 按概率抽取金额：100->0.5%, 50->1%, 20->3%, 5->10%, 2->15%, 其余 0.5元->70.5%
function pickPrize() {
  const r = Math.random() * 100;
  if (r < 0.5)  return 100;
  if (r < 1.5)  return 50;
  if (r < 4.5)  return 20;
  if (r < 14.5) return 5;
  if (r < 29.5) return 2;
  return 0.5;
}

function newScratchCard() {
  prizeAmount     = pickPrize();
  scratchRevealed = false;
  scratchActive   = false;
  scratchLast     = null;
  scratchCheckTick = 0;
  scratchResult.style.display = 'none';
  scratchPrizeEl.innerHTML =
    `<span class="amount">¥${prizeAmount}</span>` +
    `<span class="unit">元</span>` +
    `<span class="label">幸运金额</span>`;
  drawScratchCover();
}

function drawScratchCover() {
  const ctx = scratchCtx;
  const w = scratchCanvas.width, h = scratchCanvas.height;
  ctx.globalCompositeOperation = 'source-over';
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#b9c0cb');
  grad.addColorStop(0.5, '#e4e8ee');
  grad.addColorStop(1, '#a7aeba');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 中心提示
  ctx.fillStyle = 'rgba(90,98,112,0.85)';
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px "Microsoft YaHei", sans-serif';
  ctx.fillText('🎟️', w / 2, h / 2 - 36);
  ctx.fillText('刮 一 刮', w / 2, h / 2 + 30);
  ctx.font = '24px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(90,98,112,0.5)';
  ctx.fillText('试试你的手气', w / 2, h / 2 + 78);
}

function bindScratchEvents() {
  scratchCanvas.addEventListener('mousedown', (e) => {
    scratchActive = true;
    scratchLast = getScratchPos(e);
  });
  scratchCanvas.addEventListener('mousemove', (e) => {
    if (scratchActive) scratchAt(e);
  });
  window.addEventListener('mouseup', () => {
    scratchActive = false;
    scratchLast = null;
  });

  scratchCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    scratchActive = true;
    scratchLast = getScratchPos(e);
  }, { passive: false });
  scratchCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (scratchActive) scratchAt(e);
  }, { passive: false });
  scratchCanvas.addEventListener('touchend', () => {
    scratchActive = false;
    scratchLast = null;
  });

  // 再来一张：先回到支付门
  scratchNewBtn.addEventListener('click', lockScratch);
  // 确认已付款：解锁发新卡
  payConfirmBtn.addEventListener('click', unlockScratch);
}

// 把鼠标/触摸位置换算成 canvas 内部坐标
function getScratchPos(e) {
  const rect = scratchCanvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return {
    x: (p.clientX - rect.left) * (scratchCanvas.width / rect.width),
    y: (p.clientY - rect.top) * (scratchCanvas.height / rect.height)
  };
}

function scratchAt(e) {
  if (scratchRevealed) return;
  const pos = getScratchPos(e);
  const ctx = scratchCtx;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 56;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(scratchLast.x, scratchLast.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  scratchLast = pos;

  // 每刮 6 次检测一次刮开比例（避免每帧都查像素太卡）
  if (++scratchCheckTick % 6 === 0) {
    checkScratchProgress();
  }
}

// 采样统计透明像素比例，超过 55% 自动揭晓
function checkScratchProgress() {
  if (scratchRevealed) return;
  const data = scratchCtx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height).data;
  let transparent = 0, total = 0;
  for (let i = 3; i < data.length; i += 4 * 20) {
    total++;
    if (data[i] === 0) transparent++;
  }
  if (transparent / total > 0.55) {
    revealScratch();
  }
}

function revealScratch() {
  if (scratchRevealed) return;
  scratchRevealed = true;
  scratchCtx.globalCompositeOperation = 'destination-out';
  scratchCtx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
  scratchResult.style.display = 'block';
  scratchResult.innerHTML = `🎉 恭喜刮到 <strong>¥${prizeAmount}</strong> 元！`;
  confetti();
}

// ---------- 初始化 ----------
if (getSession()) {
  enterGame(); // 已登录直接进入抽奖页
} else {
  renderAuthMode();
}
