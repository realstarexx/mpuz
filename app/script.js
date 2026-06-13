/*
  script.js (v2.1) 2026-06-13T09:30:00+0530
  web: realstarex.github.io/mpuz
 
  (mpuz) Mathematical Puzzle

  Rearrange tiles on an 8×8 grid to form mathematical expressions that
  equal the target number. Supports operators, fractions, parentheses,
  drag-and-drop interaction, and automatically generated puzzles with
  guaranteed solutions.

  @author Starexx
  @license MIT
  
*/

(function () {
  'use strict';

  const gridEl     = document.getElementById('grid');
  const targetSpan = document.getElementById('target');
  const overlay    = document.getElementById('overlay');
  const tile       = document.getElementById('dragging');

  let target = 0;
  let grid = [];
  let winInProgress = false;

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  const xops = { '+': 'xadd', '-': 'xsub', '*': 'xmul', '/': 'xdiv', '(': 'xlparen', ')': 'xrparen', FRAC: 'xfrac' };

  function num(v) { return { id: Math.random().toString(36).slice(2), type: 'number', value: v, display: v.toString() }; }
  function op(o) { return { id: Math.random().toString(36).slice(2), type: 'operator', op: o, value: o, display: o === '*' ? '×' : o === '/' ? '÷' : o }; }
  function blocksToExpr(blocks) { return blocks.map(b => b.op === 'FRAC' ? `(${b.fracTop}/${b.fracBot})` : b.value).join(' '); }

  function evalBlocks(blocks) {
    if (!blocks.length) return NaN;
    const expr = blocksToExpr(blocks).trim();
    if (/^[+\-*/]/.test(expr) || /[+\-*/]$/.test(expr) || /[+\-*/]\s*[+\-*/]/.test(expr)) return NaN;
    try {
      const r = Function('"use strict"; return (' + expr + ')')();
      return typeof r === 'number' && isFinite(r) ? r : NaN;
    } catch(e) { return NaN; }
  }

  function getLines() {
    const lines = [];
    for (let r = 0; r < 8; r++) {
      let run = [];
      for (let c = 0; c < 8; c++) {
        if (grid[r][c]) run.push(grid[r][c]);
        else { if (run.length >= 3) lines.push([...run]); run = []; }
      }
      if (run.length >= 3) lines.push([...run]);
    }
    for (let c = 0; c < 8; c++) {
      let run = [];
      for (let r = 0; r < 8; r++) {
        if (grid[r][c]) run.push(grid[r][c]);
        else { if (run.length >= 3) lines.push([...run]); run = []; }
      }
      if (run.length >= 3) lines.push([...run]);
    }
    return lines;
  }

  function validChain(blocks) {
    if (blocks.length < 2) return false;
    const first = blocks[0];
    if (first.type !== 'number' && first.op !== 'FRAC' && first.value !== '(') return false;
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i], b = blocks[i + 1];
      const aIsOp = a.type === 'operator' && a.value !== '(' && a.value !== ')' && a.op !== 'FRAC';
      const bIsOp = b.type === 'operator' && b.value !== '(' && b.value !== ')' && b.op !== 'FRAC';
      if (aIsOp && bIsOp) return false;
    }
    return true;
  }

  function checkWin() {
    if (winInProgress) return;
    for (const line of getLines()) {
      if (validChain(line)) {
        const val = evalBlocks(line);
        if (!isNaN(val) && Math.abs(val - target) < 0.000001) { doWin(); return; }
      }
    }
  }

  function doWin() {
    winInProgress = true;
    overlay.classList.add('visible');
    overlay.style.animation = 'bgIn 0.1s ease forwards';
    setTimeout(() => { overlay.style.animation = 'bgOut 0.1s ease forwards'; }, 2000);
    setTimeout(() => {
      overlay.classList.remove('visible');
      overlay.style.animation = '';
      winInProgress = false;
      newPuzzle();
    }, 2000);
  }

  function buildSimple(t) {
    for (let tries = 0; tries < 300; tries++) {
      const n = rnd(2, 4);
      const nums = Array.from({length: n}, () => rnd(1, 12));
      const ops = [];
      for (let i = 0; i < n - 1; i++) {
        const o = pick(['+', '-', '*', '/']);
        if (o === '/') { if (nums[i+1] === 0) nums[i+1] = 1; nums[i] = nums[i] * nums[i+1]; }
        ops.push(o);
      }
      const blocks = [];
      for (let i = 0; i < nums.length; i++) { blocks.push(num(nums[i])); if (i < ops.length) blocks.push(op(ops[i])); }
      const val = evalBlocks(blocks);
      if (!isNaN(val) && Math.abs(val - t) < 0.000001) return blocks;
    }
    const a = rnd(1, Math.max(1, Math.abs(t) + 10)), b = t - a;
    return b >= 0 ? [num(a), op('+'), num(b)] : [num(a), op('-'), num(-b)];
  }

  function buildParen(t) {
    for (let tries = 0; tries < 300; tries++) {
      const c = rnd(1, 20), outerOp = pick(['+', '-', '*']);
      let inner;
      if (outerOp === '+') inner = t - c;
      else if (outerOp === '-') inner = t + c;
      else { if (c === 0 || t % c !== 0) continue; inner = t / c; }
      const a = rnd(1, 30), iop = pick(['+', '-']);
      const b = iop === '+' ? inner - a : a - inner;
      if (!Number.isInteger(b) || b < 1 || b > 50) continue;
      const blocks = [op('('), num(a), op(iop), num(b), op(')'), op(outerOp), num(c)];
      if (!isNaN(evalBlocks(blocks)) && Math.abs(evalBlocks(blocks) - t) < 0.000001) return blocks;
    }
    return buildSimple(t);
  }

  function buildFrac(t) {
    for (let tries = 0; tries < 300; tries++) {
      const bot = rnd(2, 10), n2 = rnd(0, 20), o = pick(['+', '-', '*']);
      let fv;
      if (o === '+') fv = t - n2;
      else if (o === '-') fv = t + n2;
      else { if (n2 === 0) continue; fv = t / n2; }
      const top = fv * bot;
      if (!Number.isInteger(top) || top < 1 || top > 99) continue;
      const fb = { id: Math.random().toString(36).slice(2), type: 'operator', op: 'FRAC', fracTop: top, fracBot: bot, value: `(${top}/${bot})`, display: `FRAC:${top}:${bot}` };
      const blocks = [fb, op(o), num(n2)];
      if (!isNaN(evalBlocks(blocks)) && Math.abs(evalBlocks(blocks) - t) < 0.000001) return blocks;
    }
    return buildSimple(t);
  }

  function newPuzzle() {
    const useFrac  = Math.random() < 0.08;
    const useParen = !useFrac && Math.random() < 0.10;
    target = rnd(-19, 49);
    targetSpan.innerText = target;

    let sol = useFrac ? buildFrac(target) : useParen ? buildParen(target) : buildSimple(target);

    const used = new Set(sol.filter(b => b.type === 'operator').map(b => b.op));
    const extras = ['+', '-', '*', '/'].filter(o => !used.has(o)).map(op);
    const padding = Array.from({length: rnd(3, 6)}, () => num(rnd(1, 12)));
    const blocks = [...sol, ...extras, ...padding];

    const flat = Array(8 * 8).fill(null);
    blocks.slice(0, 8 * 8).forEach((b, i) => { flat[i] = b; });
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    grid = [];
    for (let r = 0; r < 8; r++) {
      grid[r] = [];
      for (let c = 0; c < 8; c++) grid[r][c] = flat[r * 8 + c] || null;
    }
    ganerate();
  }

  function makeCell(block, r, c) {
    const el = document.createElement('div');
    if (!block) {
      el.className = 'cell empty';
    } else if (block.type === 'number') {
      el.className = 'cell number';
      el.innerText = block.display;
    } else if (block.op === 'FRAC') {
      el.className = 'cell xfrac';
      el.innerHTML = `<span class="frac-x">${block.fracTop}</span><span class="frac-y">${block.fracBot}</span>`;
    } else {
      el.className = 'cell ' + (xops[block.op] || 'operator');
      el.innerText = block.display;
    }
    el.dataset.row = r;
    el.dataset.col = c;
    return el;
  }

  function ganerate() {
    gridEl.innerHTML = '';
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        gridEl.appendChild(makeCell(grid[r][c], r, c));
    gridEl.addEventListener('pointerdown', onDown, {passive: false});
  }

  function refreshCell(r, c) {
    const old = gridEl.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
    if (old) old.replaceWith(makeCell(grid[r][c], r, c));
  }

  let dragging = false, srcRow = -1, srcCol = -1, lastR = -1, lastC = -1;
  let ghostX = 0, ghostY = 0, rafId = null;

  function cellAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      const c = el.closest('.cell[data-row]');
      if (c) return { row: +c.dataset.row, col: +c.dataset.col };
    }
    return null;
  }

  function dragTile(block) {
    tile.className = '';
    tile.innerHTML = '';
    if (!block) { tile.style.display = 'none'; return; }

    const sample = gridEl.querySelector('.cell');
    if (sample) {
      const r = sample.getBoundingClientRect();
      tile.style.width  = r.width  + 'px';
      tile.style.height = r.height + 'px';
    }

    if (block.type === 'number') {
      tile.classList.add('number');
      tile.innerText = block.display;
    } else if (block.op === 'FRAC') {
      tile.classList.add('xfrac', 'frac');
      tile.innerHTML = `<span class="frac-x">${block.fracTop}</span><span class="frac-y">${block.fracBot}</span>`;
    } else {
      tile.classList.add(xops[block.op] || 'operator');
      tile.innerText = block.display;
    }
    tile.style.display = 'flex';
  }

  function moveTile(x, y) {
    ghostX = x; ghostY = y;
    if (rafId === null) rafId = requestAnimationFrame(() => {
      tile.style.left = ghostX + 'px';
      tile.style.top  = ghostY + 'px';
      rafId = null;
    });
  }

  function onDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit || !grid[hit.row][hit.col]) return;
    e.preventDefault(); e.stopPropagation();
    try { gridEl.setPointerCapture(e.pointerId); } catch(_) {}

    dragging = true;
    srcRow = hit.row; srcCol = hit.col; lastR = hit.row; lastC = hit.col;
    const el = gridEl.querySelector(`.cell[data-row='${hit.row}'][data-col='${hit.col}']`);
    if (el) el.classList.add('is-source');
    dragTile(grid[hit.row][hit.col]);
    moveTile(e.clientX, e.clientY);

    function onMove(ev) {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      if (!dragging) return;
      moveTile(ev.clientX, ev.clientY);

      const h = cellAt(ev.clientX, ev.clientY);
      if (!h || (h.row === lastR && h.col === lastC)) return;

      const prevEl = gridEl.querySelector(`.cell[data-row='${lastR}'][data-col='${lastC}']`);
      if (prevEl) prevEl.classList.remove('is-source', 'is-target');

      [grid[srcRow][srcCol], grid[h.row][h.col]] = [grid[h.row][h.col], grid[srcRow][srcCol]];
      refreshCell(srcRow, srcCol);
      refreshCell(h.row, h.col);

      srcRow = h.row; srcCol = h.col; lastR = h.row; lastC = h.col;
      const newEl = gridEl.querySelector(`.cell[data-row='${srcRow}'][data-col='${srcCol}']`);
      if (newEl) newEl.classList.add('is-source');
      checkWin();
    }

    function onUp(ev) {
      if (ev.pointerId !== e.pointerId) return;
      dragging = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      tile.style.display = 'none';
      gridEl.querySelectorAll('.is-source, .is-target').forEach(el => el.classList.remove('is-source', 'is-target'));
      srcRow = srcCol = lastR = lastC = -1;
      checkWin();
      document.removeEventListener('pointermove', onMove, {capture: true});
      document.removeEventListener('pointerup',   onUp,   {capture: true});
      document.removeEventListener('pointercancel', onUp, {capture: true});
    }

    document.addEventListener('pointermove',  onMove, {capture: true, passive: false});
    document.addEventListener('pointerup',    onUp,   {capture: true});
    document.addEventListener('pointercancel', onUp,  {capture: true});
  }
  
  newPuzzle();
  window.addEventListener('resize', () => ganerate());
})();