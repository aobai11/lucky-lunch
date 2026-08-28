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
const lotteryView  = document.getElementById('lottery-view');
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
    enterLottery();
  } else {
    if (!users[username]) {
      return showError('该用户名不存在，请先注册');
    }
    if (users[username].pw !== hashPassword(password)) {
      return showError('密码错误，请重试');
    }
    setSession(username);
    enterLottery();
  }
});

// ---------- 进入 / 退出 ----------
function enterLottery() {
  const user = getSession();
  currentUserEl.textContent = user;
  authView.style.display    = 'none';
  lotteryView.style.display = 'flex';
  authForm.reset();
  hideError();
  resetWheel();
  renderHistory();
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  mode = 'login';
  renderAuthMode();
  authForm.reset();
  lotteryView.style.display = 'none';
  authView.style.display    = 'flex';
});

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

// ---------- 初始化 ----------
if (getSession()) {
  enterLottery(); // 已登录直接进入抽奖页
} else {
  renderAuthMode();
}
