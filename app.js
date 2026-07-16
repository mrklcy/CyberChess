const boardEl = document.querySelector("#board");
const logEl = document.querySelector("#log");
const formEl = document.querySelector("#commandForm");
const inputEl = document.querySelector("#commandInput");
const statusPill = document.querySelector("#statusPill");
const phaseText = document.querySelector("#phaseText");
const integrityText = document.querySelector("#integrityText");
const captureText = document.querySelector("#captureText");
const threatText = document.querySelector("#threatText");

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const pieceGlyphs = {
  wK: "\u265A",
  wQ: "\u265B",
  wR: "\u265C",
  wB: "\u265D",
  wN: "\u265E",
  wP: "\u265F",
  bK: "\u265A",
  bQ: "\u265B",
  bR: "\u265C",
  bB: "\u265D",
  bN: "\u265E",
  bP: "\u265F",
};

const lessonBank = [
  "Recon first: asset discovery reduces surprises before a change window.",
  "Validate intent: a planned move should match the observed destination risk.",
  "Least privilege matters: do the narrow move that solves the position.",
  "Logs tell the story: every command should leave a useful audit trail.",
  "Containment beats panic: capture threats only after you understand reach.",
  "Assume hostile response: the defender should expect counter-movement.",
];

let board;
let phase;
let scannedFrom;
let analyzedTo;
let selectedSquares;
let turn;
let gameOver;
let integrity;
let captures;
let lastMove;
let captureSquare;
let scannedMoves;
let lastMoveDx;
let lastMoveDy;
let animateLastMove;
let capturedPiece;

function boot() {
  board = createInitialBoard();
  phase = "scan";
  scannedFrom = null;
  analyzedTo = null;
  selectedSquares = [];
  scannedMoves = [];
  lastMoveDx = 0;
  lastMoveDy = 0;
  animateLastMove = false;
  capturedPiece = null;
  turn = "w";
  gameOver = false;
  integrity = 100;
  captures = 0;
  lastMove = [];
  captureSquare = null;
  logEl.innerHTML = "";
  addLog("system", "Simulation loaded. Type 'scan e2' to begin the operator workflow.");
  addLog("alert", "Turn protocol: scan <source>, analyze <target>, move <source> <target>.");
  render();
}

function createInitialBoard() {
  const state = {};
  const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  files.forEach((file, index) => {
    state[`${file}1`] = { color: "w", type: backRank[index] };
    state[`${file}2`] = { color: "w", type: "P" };
    state[`${file}7`] = { color: "b", type: "P" };
    state[`${file}8`] = { color: "b", type: backRank[index] };
  });
  return state;
}

function render() {
  boardEl.innerHTML = "";
  for (let rank = 8; rank >= 1; rank -= 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const squareName = `${files[fileIndex]}${rank}`;
      const square = document.createElement("div");
      const piece = board[squareName];
      square.className = `square ${(rank + fileIndex) % 2 === 1 ? "dark" : "light"}`;
      square.dataset.square = squareName;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", describeSquare(squareName));

      if (selectedSquares.includes(squareName)) square.classList.add("selected");
      if (lastMove.includes(squareName)) square.classList.add("last");
      if (captureSquare === squareName) square.classList.add("capture-flash");
      if (scannedFrom === squareName || analyzedTo === squareName) square.classList.add("target");

      // Render scanning overlays
      if (scannedFrom === squareName) {
        square.classList.add("scanning");
        const scanOverlay = document.createElement("div");
        scanOverlay.className = "scan-overlay";
        scanOverlay.innerHTML = `
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
          <div class="scan-line"></div>
        `;
        square.append(scanOverlay);
      }

      // Render analyzing overlays
      if (analyzedTo === squareName) {
        square.classList.add("analyzing");
        const analyzeOverlay = document.createElement("div");
        analyzeOverlay.className = "analyze-overlay";
        analyzeOverlay.innerHTML = `
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
          <div class="analyze-ring"></div>
          <div class="analyze-label">ANLZ</div>
        `;
        square.append(analyzeOverlay);
      }

      // Highlight legal routes
      if (scannedMoves.includes(squareName)) {
        if (!piece) {
          square.classList.add("legal-route");
          const dot = document.createElement("div");
          dot.className = "legal-route-dot";
          square.append(dot);
        } else if (piece.color === "b") {
          square.classList.add("legal-capture");
          const captureRing = document.createElement("div");
          captureRing.className = "legal-capture-ring";
          square.append(captureRing);
        }
      }

      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}`;
        pieceEl.textContent = pieceGlyphs[`${piece.color}${piece.type}`];

        // Animate piece movement from the last move coordinates
        if (animateLastMove && lastMove.length === 2 && squareName === lastMove[1]) {
          pieceEl.style.setProperty("--dx", lastMoveDx);
          pieceEl.style.setProperty("--dy", lastMoveDy);
          pieceEl.classList.add("animate-move");
        }

        square.append(pieceEl);
      }

      // Render disintegrating captured piece
      if (capturedPiece && squareName === capturedPiece.square) {
        const capturedEl = document.createElement("span");
        capturedEl.className = `piece ${capturedPiece.color === "w" ? "white" : "black"} captured-disintegrate`;
        capturedEl.textContent = pieceGlyphs[`${capturedPiece.color}${capturedPiece.type}`];
        square.append(capturedEl);
      }

      boardEl.append(square);
    }
  }

  statusPill.textContent = gameOver ? "Simulation complete" : turn === "w" ? "White operator turn" : "Red team turn";
  phaseText.textContent = phase === "scan" ? "Scan source" : phase === "analyze" ? "Analyze target" : "Execute move";
  integrityText.textContent = `${integrity}%`;
  captureText.textContent = String(captures);
  threatText.textContent = integrity > 80 ? "Low" : integrity > 55 ? "Elevated" : "Critical";
  animateLastMove = false;
}

function describeSquare(squareName) {
  const piece = board[squareName];
  if (!piece) return `${squareName}, empty`;
  return `${squareName}, ${piece.color === "w" ? "white" : "black"} ${piece.type}`;
}

function addLog(kind, text) {
  const entry = document.createElement("div");
  entry.className = `log-entry ${kind}`;
  entry.textContent = text;
  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function parseSquare(value) {
  const square = value?.toLowerCase();
  if (!/^[a-h][1-8]$/.test(square)) return null;
  return square;
}

function squareToCoords(square) {
  return {
    file: files.indexOf(square[0]),
    rank: Number(square[1]) - 1,
  };
}

function coordsToSquare(file, rank) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${files[file]}${rank + 1}`;
}

function isPathClear(from, to) {
  const a = squareToCoords(from);
  const b = squareToCoords(to);
  const fileStep = Math.sign(b.file - a.file);
  const rankStep = Math.sign(b.rank - a.rank);
  let file = a.file + fileStep;
  let rank = a.rank + rankStep;

  while (file !== b.file || rank !== b.rank) {
    if (board[coordsToSquare(file, rank)]) return false;
    file += fileStep;
    rank += rankStep;
  }
  return true;
}

function isLegalMove(from, to, color) {
  const piece = board[from];
  const target = board[to];
  if (!piece || piece.color !== color || from === to) return false;
  if (target && target.color === color) return false;

  const a = squareToCoords(from);
  const b = squareToCoords(to);
  const df = b.file - a.file;
  const dr = b.rank - a.rank;
  const absF = Math.abs(df);
  const absR = Math.abs(dr);
  const forward = color === "w" ? 1 : -1;

  if (piece.type === "P") {
    const startRank = color === "w" ? 1 : 6;
    if (df === 0 && dr === forward && !target) return true;
    if (df === 0 && dr === forward * 2 && a.rank === startRank && !target) {
      return !board[coordsToSquare(a.file, a.rank + forward)];
    }
    return absF === 1 && dr === forward && Boolean(target);
  }

  if (piece.type === "N") return (absF === 1 && absR === 2) || (absF === 2 && absR === 1);
  if (piece.type === "B") return absF === absR && isPathClear(from, to);
  if (piece.type === "R") return (df === 0 || dr === 0) && isPathClear(from, to);
  if (piece.type === "Q") return (df === 0 || dr === 0 || absF === absR) && isPathClear(from, to);
  if (piece.type === "K") return absF <= 1 && absR <= 1;
  return false;
}

function legalMovesFor(square, color) {
  return allSquares().filter((target) => isLegalMove(square, target, color));
}

function allSquares() {
  const squares = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    files.forEach((file) => squares.push(`${file}${rank}`));
  }
  return squares;
}

function commandHelp() {
  addLog("system", "Commands: scan <square>, analyze <square>, move <from> <to>, help, reset.");
  addLog("system", "Example turn: scan e2 -> analyze e4 -> move e2 e4.");
}

function handleCommand(rawCommand) {
  pulseBoard();
  const raw = rawCommand.trim().toLowerCase();
  if (!raw) return;
  addLog("", `> ${raw}`);

  const [command, arg1, arg2] = raw.split(/\s+/);
  if (command === "help") return commandHelp();
  if (command === "reset") return boot();
  if (gameOver) return addLog("error", "Simulation ended. Type 'reset' to train again.");
  if (turn !== "w") return addLog("error", "Red team is moving. Wait for the response.");

  if (command === "scan") return scanCommand(arg1);
  if (command === "analyze") return analyzeCommand(arg1);
  if (command === "move") return moveCommand(arg1, arg2);
  addLog("error", "Unknown command. Type 'help' for the runbook.");
}

function scanCommand(sourceArg) {
  const source = parseSquare(sourceArg);
  if (!source) return addLog("error", "Scan needs a board square, like 'scan g1'.");

  const piece = board[source];
  if (!piece || piece.color !== "w") return addLog("error", "Scan a white asset under your control.");

  const moves = legalMovesFor(source, "w");
  if (moves.length === 0) return addLog("alert", `${source} has no safe routes in this simulation.`);

  scannedFrom = source;
  analyzedTo = null; // Reset target on new scan selection
  selectedSquares = [source];
  scannedMoves = moves;
  phase = "analyze";
  addLog("system", `Scan complete: ${pieceName(piece)} at ${source}. Legal routes: ${moves.join(", ")}.`);
  addLog("alert", lessonBank[Math.floor(Math.random() * lessonBank.length)]);
  render();
}

function analyzeCommand(targetArg) {
  if (!scannedFrom) return addLog("error", "Run 'scan <source>' before analysis.");
  const target = parseSquare(targetArg);
  if (!target) return addLog("error", "Analyze needs a board square, like 'analyze e4'.");

  if (!isLegalMove(scannedFrom, target, "w")) {
    integrity = Math.max(0, integrity - 6);
    addLog("error", `Rejected route: ${scannedFrom} to ${target} is not legal. Integrity -6%.`);
    return render();
  }

  analyzedTo = target;
  selectedSquares = [scannedFrom, target];
  phase = "move";
  const targetPiece = board[target];
  const risk = targetPiece ? `Capture opportunity: ${pieceName(targetPiece)}.` : "Destination is clear.";
  addLog("system", `Analysis complete: ${risk} Execute with 'move ${scannedFrom} ${target}'.`);
  render();
}

function moveCommand(fromArg, toArg) {
  if (phase !== "move") return addLog("error", "Run scan and analyze before moving.");
  const from = parseSquare(fromArg);
  const to = parseSquare(toArg);
  if (from !== scannedFrom || to !== analyzedTo) {
    integrity = Math.max(0, integrity - 8);
    addLog("error", `Command drift detected. Expected 'move ${scannedFrom} ${analyzedTo}'. Integrity -8%.`);
    return render();
  }

  executeMove(from, to, "w");
  if (gameOver) return render();

  turn = "b";
  resetWorkflow();
  render();
  window.setTimeout(redTeamMove, 650);
}

function executeMove(from, to, color) {
  const moving = board[from];
  const target = board[to];
  captureSquare = target ? to : null;
  if (target) {
    captures += color === "w" ? 1 : 0;
    capturedPiece = { type: target.type, color: target.color, square: to };
    addLog(color === "w" ? "alert" : "error", `${color === "w" ? "Contained" : "Breach"}: ${pieceName(target)} removed at ${to}.`);
    if (target.type === "K") {
      gameOver = true;
      addLog(color === "w" ? "system" : "error", color === "w" ? "Black king captured. Training objective complete." : "White king captured. The incident escalated.");
    }
  } else {
    capturedPiece = null;
  }

  const a = squareToCoords(from);
  const b = squareToCoords(to);
  lastMoveDx = a.file - b.file;
  lastMoveDy = b.rank - a.rank;
  animateLastMove = true;

  board[to] = moving;
  delete board[from];
  lastMove = [from, to];

  // Enable 3D perspective during movement
  const boardWrap = document.querySelector(".board-wrap");
  if (boardWrap) boardWrap.classList.add("moving-3d");

  window.setTimeout(() => {
    captureSquare = null;
    capturedPiece = null;

    // Disable 3D perspective once movement finishes
    const boardWrap = document.querySelector(".board-wrap");
    if (boardWrap) boardWrap.classList.remove("moving-3d");

    render();
  }, 700);

  if (moving.type === "P" && (to[1] === "8" || to[1] === "1")) {
    moving.type = "Q";
    addLog("system", `Privilege escalation controlled: pawn promoted to queen at ${to}.`);
  }
}

function resetWorkflow() {
  phase = "scan";
  scannedFrom = null;
  analyzedTo = null;
  selectedSquares = [];
  scannedMoves = [];
}

function redTeamMove() {
  if (gameOver) return;
  const moves = [];
  Object.keys(board).forEach((from) => {
    if (board[from].color === "b") {
      legalMovesFor(from, "b").forEach((to) => moves.push({ from, to, capture: Boolean(board[to]) }));
    }
  });

  if (moves.length === 0) {
    gameOver = true;
    addLog("system", "Red team has no available move. Training objective complete.");
    return render();
  }

  moves.sort((a, b) => Number(b.capture) - Number(a.capture));
  const top = moves.slice(0, Math.min(6, moves.length));
  const move = top[Math.floor(Math.random() * top.length)];
  executeMove(move.from, move.to, "b");
  if (move.capture) integrity = Math.max(0, integrity - 14);
  addLog("error", `Red team executed: ${move.from} -> ${move.to}.`);
  if (!gameOver && integrity <= 0) {
    gameOver = true;
    addLog("error", "Integrity depleted. The training environment was compromised.");
  }
  turn = "w";
  render();
}

function pieceName(piece) {
  const colors = { w: "white", b: "black" };
  const types = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
  return `${colors[piece.color]} ${types[piece.type]}`;
}

function pulseBoard() {
  boardEl.classList.remove("executing");
  void boardEl.offsetWidth;
  boardEl.classList.add("executing");
}
formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  handleCommand(inputEl.value);
  inputEl.value = "";
  inputEl.focus();
});

boot();
