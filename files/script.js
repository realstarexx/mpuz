/**
@author Starexx
@license MIT

Project: Mpuz - Just a mathematical game
**/



(function() {
  const GRID_SIZE = 8;
  let targetValue = 0;
  let gridData = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  let winInProgress = false;
  let puzzleCount = 1;

  let dragActive = false;
  let dragCurrentRow = -1, dragCurrentCol = -1;
  let lastSwapX = 0, lastSwapY = 0;
  const SWAP_THRESHOLD = 12;

  const gridEl         = document.getElementById('grid');
  const targetSpan     = document.getElementById('targetNumber');
  const liveResultSpan = document.getElementById('liveResultDisplay');
  const puzzleSpan     = document.getElementById('puzzleNumber');
  const winOverlay     = document.getElementById('winOverlay');
  const winText        = document.getElementById('winText');

  function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2,8); }

  function opClass(op) {
    if (op === '+') return 'op-add';
    if (op === '-') return 'op-sub';
    if (op === '*') return 'op-mul';
    if (op === '/') return 'op-div';
    if (op === '(') return 'op-lparen';
    if (op === ')') return 'op-rparen';
    if (op === 'FRAC') return 'op-frac';
    return 'operator';
  }

  /* ── evaluate expression (handles FRAC inline) ── */
  // FRAC block contributes "(top/bot)" in expression
  function blocksToExpr(blocks) {
    return blocks.map(b => {
      if (b.type === 'number') return b.value.toString();
      if (b.op === 'FRAC') return `(${b.fracTop}/${b.fracBot})`;
      return b.value;
    }).join(' ');
  }

  function evaluateExpression(blocks) {
    if (!blocks.length) return NaN;
    const exprStr = blocksToExpr(blocks);
    if (/^[\+\-\*\/]/.test(exprStr.trim()) || /[\+\-\*\/]$/.test(exprStr.trim())) return NaN;
    if (/([\+\-\*\/]\s*[\+\-\*\/])/.test(exprStr)) return NaN;
    try {
      const r = Function('"use strict"; return (' + exprStr + ')')();
      return (typeof r === 'number' && isFinite(r)) ? r : NaN;
    } catch(e) { return NaN; }
  }

  function getAllLines() {
    const lines = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      let run = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        if (gridData[r][c]) run.push(gridData[r][c]);
        else { if (run.length >= 3) lines.push([...run]); run = []; }
      }
      if (run.length >= 3) lines.push([...run]);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let run = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        if (gridData[r][c]) run.push(gridData[r][c]);
        else { if (run.length >= 3) lines.push([...run]); run = []; }
      }
      if (run.length >= 3) lines.push([...run]);
    }
    return lines;
  }

  function isValidChain(blocks) {
    if (blocks.length < 2) return false;
    // Must start with number or (
    const first = blocks[0];
    if (first.type !== 'number' && first.op !== 'FRAC' && first.value !== '(') return false;

    // Simplified: no two same-type operators in a row (ignoring parens)
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i], b = blocks[i+1];
      const aIsNum = a.type === 'number' || a.op === 'FRAC';
      const bIsNum = b.type === 'number' || b.op === 'FRAC';
      const aIsOp  = a.type === 'operator' && a.value !== '(' && a.value !== ')';
      const bIsOp  = b.type === 'operator' && b.value !== '(' && b.value !== ')';
      if (aIsOp && bIsOp) return false;
    }
    return true;
  }

  function evaluateAllAndCheckWin() {
    if (winInProgress) return false;
    const lines = getAllLines();
    let bestResult = NaN;

    for (let line of lines) {
      if (isValidChain(line)) {
        const val = evaluateExpression(line);
        if (!isNaN(val)) {
          if (Math.abs(val - targetValue) < 0.000001) { winPuzzle(); return true; }
          if (isNaN(bestResult)) bestResult = val;
        }
      }
    }
    liveResultSpan.innerText = isNaN(bestResult) ? 0 : (Math.round(bestResult * 1000) / 1000);
    return false;
  }

  function winPuzzle() {
    winInProgress = true;

    winOverlay.classList.add('visible');
    winOverlay.style.animation = 'bgIn 0.2s ease forwards';

    setTimeout(() => {
      winOverlay.style.animation = 'bgOut 0.2s ease forwards';
    }, 2700);

    setTimeout(() => {
      winOverlay.classList.remove('visible');
      winOverlay.style.animation = '';
      winInProgress = false;
      puzzleCount++;
      puzzleSpan.innerText = puzzleCount;
      generateAndLoad();
    }, 3000);
  }

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function generateAndLoad() {
    const { target, blocks } = buildPuzzle();
    targetValue = target;
    targetSpan.innerText = target;
    liveResultSpan.innerText = 0;
    placeBlocks(blocks);
    renderGrid();
    evaluateAllAndCheckWin();
  }

  function buildPuzzle() {
    const useFrac  = Math.random() < 0.08;
    const useParen = !useFrac && Math.random() < 0.10;
    const target   = rnd(-19, 49);

    let solutionBlocks;
    if (useFrac)       solutionBlocks = buildFracPuzzle(target);
    else if (useParen) solutionBlocks = buildParenPuzzle(target);
    else               solutionBlocks = buildSimplePuzzle(target);

    // guarantee all 4 basic operators appear somewhere on the grid.
    // add any missing ops as extra (distractor) blocks.
    
    const allOps = ['+', '-', '*', '/'];
    const usedOps = new Set(solutionBlocks.filter(b => b.type === 'operator').map(b => b.op));
    const missingOps = allOps.filter(o => !usedOps.has(o)).map(mkOp);
    
    // also pad with a few random numbers so the grid isn't sparse
    const padNums = Array.from({length: rnd(3,6)}, () => mkNum(rnd(1,12)));
    const allBlocks = [...solutionBlocks, ...missingOps, ...padNums];

    return { target, blocks: allBlocks };
  }

  /* plain arithmetic puzzle: num op num ... */
  function buildSimplePuzzle(target) {
    const ops = ['+', '-', '*', '/'];
    for (let attempt = 0; attempt < 300; attempt++) {
      const numCount = rnd(2, 4);
      const nums = [];
      const chosenOps = [];

      for (let i = 0; i < numCount; i++) nums.push(rnd(1, 12));
      for (let i = 0; i < numCount - 1; i++) {
        const op = pick(ops);
        if (op === '/') {
          if (nums[i + 1] === 0) nums[i+1] = 1;
          nums[i] = nums[i] * nums[i+1];
        }
        chosenOps.push(op);
      }

      const exprBlocks = makeBlockList(nums, chosenOps);
      const val = evaluateExpression(exprBlocks);
      if (!isNaN(val) && Math.abs(val - target) < 0.000001) return exprBlocks;
    }

    const a = rnd(1, Math.max(1, Math.abs(target) + 10));
    const b = target - a;
    return b >= 0 ? makeBlockList([a, b], ['+']) : makeBlockList([a, -b], ['-']);
  }

  /* paren puzzle: (a op b) op c = target */
  function buildParenPuzzle(target) {
    const outerOps = ['+', '-', '*'];
    for (let attempt = 0; attempt < 300; attempt++) {
      const c = rnd(1, 20);
      const outerOp = pick(outerOps);
      let innerTarget;

      if (outerOp === '+') innerTarget = target - c;
      else if (outerOp === '-') innerTarget = target + c;
      else { // *
        if (c === 0 || target % c !== 0) continue;
        innerTarget = target / c;
      }

      const a = rnd(1, 30);
      const innerOp = pick(['+', '-']);
      const b = innerOp === '+' ? innerTarget - a : a - innerTarget;
      if (!Number.isInteger(b) || b < 1 || b > 50) continue;

      // Build: ( a innerOp b ) outerOp c
      const blocks = [
        mkOp('('),
        mkNum(a),
        mkOp(innerOp),
        mkNum(b),
        mkOp(')'),
        mkOp(outerOp),
        mkNum(c),
      ];
      const val = evaluateExpression(blocks);
      if (!isNaN(val) && Math.abs(val - target) < 0.000001) return blocks;
    }
    return buildSimplePuzzle(target);
  }

  /* fraction (as em-dash) puzzle: FRAC(top,bot) op num = target */
  function buildFracPuzzle(target) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const bot = rnd(2, 10);
      const num2 = rnd(0, 20);
      const op = pick(['+', '-', '*']);
      let fracVal;
      if (op === '+') fracVal = target - num2;
      else if (op === '-') fracVal = target + num2;
      else { if (num2 === 0) continue; fracVal = target / num2; }

      // fracVal = top/bot => top = fracVal * bot
      const top = fracVal * bot;
      if (!Number.isInteger(top) || top < 1 || top > 99) continue;
      const fracBlock = {
        id: uid(),
        type: 'operator',
        op: 'FRAC',
        fracTop: top,
        fracBot: bot,
        value: `(${top}/${bot})`,
        display: `FRAC:${top}:${bot}`
      };

      const blocks = [fracBlock, mkOp(op), mkNum(num2)];
      const val = evaluateExpression(blocks);
      if (!isNaN(val) && Math.abs(val - target) < 0.000001) return blocks;
    }
    return buildSimplePuzzle(target);
  }
  function mkNum(v) {
    return { id: uid(), type: 'number', value: v, display: v.toString() };
  }
  function mkOp(op) {
    const display = op === '*' ? '×' : op === '/' ? '÷' : op;
    return { id: uid(), type: 'operator', op: op, value: op, display };
  }
  function makeBlockList(nums, ops) {
    const blocks = [];
    for (let i = 0; i < nums.length; i++) {
      blocks.push(mkNum(nums[i]));
      if (i < ops.length) blocks.push(mkOp(ops[i]));
    }
    return blocks;
  }

  function placeBlocks(blocks) {
    const total = GRID_SIZE * GRID_SIZE;
    let flat = Array(total).fill(null);
    blocks.slice(0, total).forEach((b, i) => flat[i] = b);
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    let idx = 0;
    for (let r = 0; r < GRID_SIZE; r++)
      for (let c = 0; c < GRID_SIZE; c++)
        gridData[r][c] = flat[idx++] || null;
  }

  function makeCellEl(block, row, col) {
    const cell = document.createElement('div');
    let cls = 'cell';
    if (!block) {
      cls += ' empty';
    } else if (block.type === 'number') {
      cls += ' number';
    } else {
      cls += ' ' + opClass(block.op || block.value);
    }
    cell.className = cls;
    cell.setAttribute('data-row', row);
    cell.setAttribute('data-col', col);

    if (block) {
      if (block.op === 'FRAC') {
        cell.innerHTML = `<span class="frac-top">${block.fracTop}</span><span class="frac-bot">${block.fracBot}</span>`;
      } else {
        cell.innerText = block.display;
      }
    }
    return cell;
  }

  function swapBlocks(r1, c1, r2, c2) {
    const t = gridData[r1][c1];
    gridData[r1][c1] = gridData[r2][c2];
    gridData[r2][c2] = t;
  }

  function updateCellElement(row, col) {
    const cell = gridEl.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
    if (!cell) return;
    const block = gridData[row][col];
    const newCell = makeCellEl(block, row, col);
    if (cell.classList.contains('dragging-source')) newCell.classList.add('dragging-source');
    cell.replaceWith(newCell);
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++)
      for (let c = 0; c < GRID_SIZE; c++)
        gridEl.appendChild(makeCellEl(gridData[r][c], r, c));
    gridEl.addEventListener('pointerdown', onPointerDown);
  }

  /* ── block dragging ── */
  function getCellAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const cell = el.closest('.cell');
    if (!cell) return null;
    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    if (isNaN(row) || isNaN(col)) return null;
    return { cell, row, col };
  }

  function onPointerDown(e) {
    const hit = getCellAt(e.clientX, e.clientY);
    if (!hit || !gridData[hit.row][hit.col]) return;
    e.preventDefault();

    dragActive = true;
    dragCurrentRow = hit.row;
    dragCurrentCol = hit.col;
    lastSwapX = e.clientX;
    lastSwapY = e.clientY;
    hit.cell.classList.add('dragging-source');

    function onMove(e) {
      if (!dragActive) return;
      if (Math.abs(e.clientX - lastSwapX) < SWAP_THRESHOLD && Math.abs(e.clientY - lastSwapY) < SWAP_THRESHOLD) return;

      const srcCell = gridEl.querySelector(`.cell[data-row='${dragCurrentRow}'][data-col='${dragCurrentCol}']`);
      if (srcCell) srcCell.style.pointerEvents = 'none';
      const hit2 = getCellAt(e.clientX, e.clientY);
      if (srcCell) srcCell.style.pointerEvents = '';

      if (!hit2 || (hit2.row === dragCurrentRow && hit2.col === dragCurrentCol)) return;

      swapBlocks(dragCurrentRow, dragCurrentCol, hit2.row, hit2.col);
      updateCellElement(dragCurrentRow, dragCurrentCol);
      updateCellElement(hit2.row, hit2.col);

      const newSrc = gridEl.querySelector(`.cell[data-row='${hit2.row}'][data-col='${hit2.col}']`);
      if (srcCell) srcCell.classList.remove('dragging-source');
      if (newSrc)  newSrc.classList.add('dragging-source');

      dragCurrentRow = hit2.row;
      dragCurrentCol = hit2.col;
      lastSwapX = e.clientX;
      lastSwapY = e.clientY;

      evaluateAllAndCheckWin();
    }

    function onUp() {
      dragActive = false;
      const srcCell = gridEl.querySelector(`.cell[data-row='${dragCurrentRow}'][data-col='${dragCurrentCol}']`);
      if (srcCell) srcCell.classList.remove('dragging-source');
      dragCurrentRow = -1; dragCurrentCol = -1;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }
  
  generateAndLoad();
  window.addEventListener('resize', () => renderGrid());})();
