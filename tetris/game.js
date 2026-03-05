/* =============================================
   TETRIS — Core Game Engine
   Cyberpunk Neon Edition
   ============================================= */

(() => {
  'use strict';

  // ===== Constants =====
  const COLS = 10;
  const ROWS = 20;
  const EMPTY = 0;

  // Scoring table (NES-style, scaled by level)
  const SCORE_TABLE = [0, 100, 300, 500, 800];
  const LINES_PER_LEVEL = 10;
  const BASE_DROP_INTERVAL = 800;
  const MIN_DROP_INTERVAL = 50;
  const SOFT_DROP_INTERVAL = 50;
  const LOCK_DELAY = 500;

  // Tetromino definitions: each shape has 4 rotation states
  const TETROMINOES = {
    I: {
      color: '#00f0ff',
      glow: 'rgba(0,240,255,0.6)',
      states: [
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
        [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
        [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]]
      ]
    },
    O: {
      color: '#ffe600',
      glow: 'rgba(255,230,0,0.6)',
      states: [
        [[1, 1], [1, 1]],
        [[1, 1], [1, 1]],
        [[1, 1], [1, 1]],
        [[1, 1], [1, 1]]
      ]
    },
    T: {
      color: '#b84dff',
      glow: 'rgba(184,77,255,0.6)',
      states: [
        [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
        [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
        [[0, 1, 0], [1, 1, 0], [0, 1, 0]]
      ]
    },
    S: {
      color: '#39ff14',
      glow: 'rgba(57,255,20,0.6)',
      states: [
        [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
        [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
        [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
      ]
    },
    Z: {
      color: '#ff003c',
      glow: 'rgba(255,0,60,0.6)',
      states: [
        [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
        [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
        [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
        [[0, 1, 0], [1, 1, 0], [1, 0, 0]]
      ]
    },
    J: {
      color: '#4d4dff',
      glow: 'rgba(77,77,255,0.6)',
      states: [
        [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
        [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
        [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
        [[0, 1, 0], [0, 1, 0], [1, 1, 0]]
      ]
    },
    L: {
      color: '#ff6a00',
      glow: 'rgba(255,106,0,0.6)',
      states: [
        [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
        [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
        [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
        [[1, 1, 0], [0, 1, 0], [0, 1, 0]]
      ]
    }
  };

  // SRS Wall Kick Data
  const WALL_KICKS = {
    normal: [
      // 0→1, 1→2, 2→3, 3→0
      [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]
    ],
    I: [
      [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
      [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]
    ]
  };

  const PIECE_NAMES = Object.keys(TETROMINOES);

  // ===== DOM Elements =====
  const gameCanvas = document.getElementById('gameCanvas');
  const gameCtx = gameCanvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('holdCanvas');
  const holdCtx = holdCanvas.getContext('2d');
  const particleCanvas = document.getElementById('particleCanvas');
  const particleCtx = particleCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');

  const startOverlay = document.getElementById('startOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');

  // ===== Game State =====
  let board = [];
  let currentPiece = null;
  let nextPiece = null;
  let holdPiece = null;
  let canHold = true;
  let score = 0;
  let level = 1;
  let totalLines = 0;
  let gameState = 'start'; // start, playing, paused, gameover
  let dropInterval = BASE_DROP_INTERVAL;
  let lastDropTime = 0;
  let lockTimer = null;
  let animationId = null;
  let bag = [];

  // Particle system
  let particles = [];

  // Line clear animation
  let clearingRows = [];
  let clearAnimFrame = 0;
  const CLEAR_ANIM_DURATION = 18;

  // ===== Initialization =====
  function init() {
    // Size canvases
    const style = getComputedStyle(document.documentElement);
    const cellSize = parseInt(style.getPropertyValue('--cell-size')) || 32;

    gameCanvas.width = COLS * cellSize;
    gameCanvas.height = ROWS * cellSize;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    });

    resetBoard();
    setupControls();
    drawBoard();
    drawNextPreview();
    drawHoldPreview();
    gameLoop(0);
  }

  function resetBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  }

  function getCellSize() {
    return gameCanvas.width / COLS;
  }

  // ===== 7-Bag Random Generator =====
  function fillBag() {
    bag = [...PIECE_NAMES];
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function getNextPieceName() {
    if (bag.length === 0) fillBag();
    return bag.pop();
  }

  // ===== Piece Management =====
  function createPiece(name) {
    const t = TETROMINOES[name];
    const shape = t.states[0];
    return {
      name,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: name === 'I' ? -1 : 0,
      rotation: 0,
      color: t.color,
      glow: t.glow
    };
  }

  function getShape(piece) {
    return TETROMINOES[piece.name].states[piece.rotation];
  }

  function spawnPiece() {
    if (!nextPiece) {
      nextPiece = createPiece(getNextPieceName());
    }
    currentPiece = nextPiece;
    nextPiece = createPiece(getNextPieceName());
    canHold = true;

    // Check game over
    if (!isValid(currentPiece, currentPiece.x, currentPiece.y, currentPiece.rotation)) {
      gameOver();
    }

    drawNextPreview();
  }

  // ===== Collision Detection =====
  function isValid(piece, px, py, rot) {
    const shape = TETROMINOES[piece.name].states[rot];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return false;
        if (y >= 0 && board[y][x] !== EMPTY) return false;
      }
    }
    return true;
  }

  // ===== Movement =====
  function movePiece(dx, dy) {
    if (!currentPiece || gameState !== 'playing') return false;
    const nx = currentPiece.x + dx;
    const ny = currentPiece.y + dy;
    if (isValid(currentPiece, nx, ny, currentPiece.rotation)) {
      currentPiece.x = nx;
      currentPiece.y = ny;
      if (dy === 0) resetLockTimer();
      return true;
    }
    return false;
  }

  function rotatePiece(dir = 1) {
    if (!currentPiece || gameState !== 'playing') return;
    const newRot = (currentPiece.rotation + dir + 4) % 4;
    const kicks = currentPiece.name === 'I' ? WALL_KICKS.I : WALL_KICKS.normal;
    const kickIndex = currentPiece.rotation;

    for (const [kx, ky] of kicks[kickIndex]) {
      const nx = currentPiece.x + kx;
      const ny = currentPiece.y - ky; // SRS Y is inverted
      if (isValid(currentPiece, nx, ny, newRot)) {
        currentPiece.x = nx;
        currentPiece.y = ny;
        currentPiece.rotation = newRot;
        resetLockTimer();
        return;
      }
    }
  }

  function hardDrop() {
    if (!currentPiece || gameState !== 'playing') return;
    let dropDist = 0;
    while (isValid(currentPiece, currentPiece.x, currentPiece.y + 1, currentPiece.rotation)) {
      currentPiece.y++;
      dropDist++;
    }
    score += dropDist * 2;
    updateScore();
    lockPiece();
  }

  function softDrop() {
    if (movePiece(0, 1)) {
      score += 1;
      updateScore();
    }
  }

  function getGhostY() {
    if (!currentPiece) return 0;
    let gy = currentPiece.y;
    while (isValid(currentPiece, currentPiece.x, gy + 1, currentPiece.rotation)) {
      gy++;
    }
    return gy;
  }

  // ===== Hold =====
  function holdCurrentPiece() {
    if (!currentPiece || !canHold || gameState !== 'playing') return;
    canHold = false;
    const name = currentPiece.name;
    if (holdPiece) {
      const heldName = holdPiece.name;
      holdPiece = createPiece(name);
      currentPiece = createPiece(heldName);
    } else {
      holdPiece = createPiece(name);
      spawnPiece();
    }
    drawHoldPreview();
  }

  // ===== Lock & Clear =====
  function resetLockTimer() {
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = null;
  }

  function startLockTimer() {
    if (lockTimer) return;
    lockTimer = setTimeout(() => {
      lockPiece();
    }, LOCK_DELAY);
  }

  function lockPiece() {
    if (!currentPiece) return;
    resetLockTimer();
    const shape = getShape(currentPiece);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const y = currentPiece.y + r;
        const x = currentPiece.x + c;
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
          board[y][x] = { color: currentPiece.color, glow: currentPiece.glow };
        }
      }
    }

    // Check for line clears
    const fullRows = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(cell => cell !== EMPTY)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      clearingRows = fullRows;
      clearAnimFrame = 0;
      spawnLineClearParticles(fullRows);
    } else {
      spawnPiece();
    }
  }

  function finishLineClear() {
    const numCleared = clearingRows.length;

    // Remove rows top-to-bottom
    clearingRows.sort((a, b) => a - b);
    for (const row of clearingRows) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(EMPTY));
    }

    totalLines += numCleared;
    score += SCORE_TABLE[numCleared] * level;
    level = Math.floor(totalLines / LINES_PER_LEVEL) + 1;
    dropInterval = Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * 60);

    updateScore();
    clearingRows = [];
    clearAnimFrame = 0;
    spawnPiece();
  }

  // ===== Score Display =====
  function updateScore() {
    scoreEl.textContent = score.toLocaleString();
    levelEl.textContent = level;
    linesEl.textContent = totalLines;
  }

  // ===== Game State =====
  function startGame() {
    resetBoard();
    score = 0;
    level = 1;
    totalLines = 0;
    dropInterval = BASE_DROP_INTERVAL;
    holdPiece = null;
    currentPiece = null;
    nextPiece = null;
    bag = [];
    particles = [];
    clearingRows = [];
    updateScore();
    drawHoldPreview();

    gameState = 'playing';
    startOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    spawnPiece();
    lastDropTime = performance.now();
  }

  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
      pauseOverlay.classList.remove('hidden');
    } else if (gameState === 'paused') {
      gameState = 'playing';
      pauseOverlay.classList.add('hidden');
      lastDropTime = performance.now();
    }
  }

  function gameOver() {
    gameState = 'gameover';
    const finalEl = gameOverOverlay.querySelector('.final-score');
    finalEl.textContent = `SCORE: ${score.toLocaleString()}`;
    gameOverOverlay.classList.remove('hidden');
  }

  // ===== Particle System =====
  function spawnLineClearParticles(rows) {
    const cellSize = getCellSize();
    const boardRect = gameCanvas.getBoundingClientRect();

    for (const row of rows) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[row][c];
        if (cell === EMPTY) continue;
        const cx = boardRect.left + c * cellSize + cellSize / 2;
        const cy = boardRect.top + row * cellSize + cellSize / 2;

        for (let i = 0; i < 6; i++) {
          particles.push({
            x: cx,
            y: cy,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 3,
            life: 1,
            decay: 0.015 + Math.random() * 0.02,
            size: 2 + Math.random() * 4,
            color: cell.color || '#00f0ff'
          });
        }
      }
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (const p of particles) {
      particleCtx.globalAlpha = p.life;
      particleCtx.fillStyle = p.color;
      particleCtx.shadowColor = p.color;
      particleCtx.shadowBlur = 8;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      particleCtx.fill();
    }
    particleCtx.globalAlpha = 1;
    particleCtx.shadowBlur = 0;
  }

  // ===== Rendering =====
  function drawBoard() {
    const cs = getCellSize();
    const w = gameCanvas.width;
    const h = gameCanvas.height;

    // Background
    gameCtx.fillStyle = '#05050d';
    gameCtx.fillRect(0, 0, w, h);

    // Grid lines
    gameCtx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    gameCtx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      gameCtx.beginPath();
      gameCtx.moveTo(c * cs, 0);
      gameCtx.lineTo(c * cs, h);
      gameCtx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      gameCtx.beginPath();
      gameCtx.moveTo(0, r * cs);
      gameCtx.lineTo(w, r * cs);
      gameCtx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== EMPTY) {
          // Check if this row is being cleared
          if (clearingRows.includes(r)) {
            const flash = Math.sin((clearAnimFrame / CLEAR_ANIM_DURATION) * Math.PI);
            gameCtx.fillStyle = `rgba(255, 255, 255, ${flash * 0.8})`;
            gameCtx.fillRect(c * cs, r * cs, cs, cs);
          } else {
            drawCell(gameCtx, c, r, board[r][c].color, board[r][c].glow, cs);
          }
        }
      }
    }

    // Ghost piece
    if (currentPiece && gameState === 'playing' && clearingRows.length === 0) {
      const ghostY = getGhostY();
      const shape = getShape(currentPiece);
      gameCtx.globalAlpha = 0.2;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const x = currentPiece.x + c;
          const y = ghostY + r;
          if (y >= 0) {
            drawCell(gameCtx, x, y, currentPiece.color, currentPiece.glow, cs);
          }
        }
      }
      gameCtx.globalAlpha = 1;
    }

    // Current piece
    if (currentPiece && gameState === 'playing' && clearingRows.length === 0) {
      const shape = getShape(currentPiece);
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const x = currentPiece.x + c;
          const y = currentPiece.y + r;
          if (y >= 0) {
            drawCell(gameCtx, x, y, currentPiece.color, currentPiece.glow, cs);
          }
        }
      }
    }
  }

  function drawCell(ctx, col, row, color, glow, cs) {
    const x = col * cs;
    const y = row * cs;
    const inset = 1;

    // Glow effect
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;

    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(x + inset, y + inset, cs - inset * 2, cs - inset * 2);

    // Highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + inset, y + inset, cs - inset * 2, 2);
    ctx.fillRect(x + inset, y + inset, 2, cs - inset * 2);

    // Dark edge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + cs - inset - 2, y + inset, 2, cs - inset * 2);
    ctx.fillRect(x + inset, y + cs - inset - 2, cs - inset * 2, 2);
  }

  function drawPreview(ctx, canvas, piece) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!piece) return;

    const shape = TETROMINOES[piece.name].states[0];
    const rows = shape.length;
    const cols = shape[0].length;
    const cellSize = Math.min(canvas.width / (cols + 1), canvas.height / (rows + 1));
    const offsetX = (canvas.width - cols * cellSize) / 2;
    const offsetY = (canvas.height - rows * cellSize) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!shape[r][c]) continue;
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        ctx.shadowColor = piece.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = piece.color;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 1, y + 1, cellSize - 2, 2);
      }
    }
  }

  function drawNextPreview() {
    drawPreview(nextCtx, nextCanvas, nextPiece);
  }

  function drawHoldPreview() {
    drawPreview(holdCtx, holdCanvas, holdPiece);
  }

  // ===== Game Loop =====
  function gameLoop(timestamp) {
    animationId = requestAnimationFrame(gameLoop);

    if (gameState === 'playing') {
      // Line clear animation
      if (clearingRows.length > 0) {
        clearAnimFrame++;
        if (clearAnimFrame >= CLEAR_ANIM_DURATION) {
          finishLineClear();
        }
      } else {
        // Gravity
        if (timestamp - lastDropTime >= dropInterval) {
          if (!movePiece(0, 1)) {
            startLockTimer();
          }
          lastDropTime = timestamp;
        }

        // Check if piece should lock
        if (currentPiece && !isValid(currentPiece, currentPiece.x, currentPiece.y + 1, currentPiece.rotation)) {
          startLockTimer();
        }
      }
    }

    updateParticles();
    drawBoard();
    drawParticles();
  }

  // ===== Controls =====
  function setupControls() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.repeat && !['ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      switch (e.key) {
        case 'Enter':
          if (gameState === 'start' || gameState === 'gameover') {
            startGame();
          }
          break;
        case 'p':
        case 'P':
          if (gameState === 'playing' || gameState === 'paused') {
            togglePause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          softDrop();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotatePiece(1);
          break;
        case 'z':
        case 'Z':
          rotatePiece(-1);
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'c':
        case 'C':
          holdCurrentPiece();
          break;
      }
    });

    // Mobile buttons
    const btn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); });
        el.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
      }
    };

    btn('btnLeft', () => movePiece(-1, 0));
    btn('btnRight', () => movePiece(1, 0));
    btn('btnRotate', () => rotatePiece(1));
    btn('btnDown', () => softDrop());
    btn('btnDrop', () => hardDrop());

    // Touch swipe for mobile (on the canvas)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    gameCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    }, { passive: false });

    gameCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (gameState === 'start' || gameState === 'gameover') {
        startGame();
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      if (dt < 200 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        rotatePiece(1);
      }
    }, { passive: false });
  }

  // ===== Start =====
  init();

})();
