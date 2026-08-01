const chessboard = document.getElementById('chessboard');
const statusDisplay = document.getElementById('status');
// NEW: Promotion Modal Elements
const promotionModal = document.getElementById('promotion-modal');
const promoOptionsContainer = document.getElementById('promo-options');

// Board State
let board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let currentPlayer = 'white';
let selectedSquare = null;
let gameOver = false;
let castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
let enPassantTarget = null;
// NEW: Store promotion data temporarily
let pendingPromotion = null; // Stores {row, col, color}

const pieceImages = {
    'r': 'rook-b.svg', 'n': 'knight-b.svg', 'b': 'bishop-b.svg', 
    'q': 'queen-b.svg', 'k': 'king-b.svg', 'p': 'pawn-b.svg',
    'R': 'rook-w.svg', 'N': 'knight-w.svg', 'B': 'bishop-w.svg', 
    'Q': 'queen-w.svg', 'K': 'king-w.svg', 'P': 'pawn-w.svg'
};

function renderBoard() {
    chessboard.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;

            if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                square.classList.add('selected');
            }

            const piece = board[row][col];
            if (piece) {
                const img = document.createElement('img');
                img.src = `images/${pieceImages[piece]}`;
                img.className = 'piece';
                square.appendChild(img);
            }

            square.addEventListener('click', () => handleSquareClick(row, col));
            chessboard.appendChild(square);
        }
    }
}

function handleSquareClick(row, col) {
    // UPDATED: Block clicks if game over OR promotion choice is pending
    if (gameOver || pendingPromotion) return;

    const piece = board[row][col];
    const isWhitePiece = piece && piece === piece.toUpperCase();
    const isCurrentPlayerPiece = (currentPlayer === 'white' && isWhitePiece) || (currentPlayer === 'black' && !isWhitePiece && piece);

    if (selectedSquare) {
        if (piece && isCurrentPlayerPiece) {
            selectedSquare = { row, col };
            renderBoard();
            return;
        }

        const startR = selectedSquare.row;
        const startC = selectedSquare.col;

        if (isValidMove(startR, startC, row, col, board)) {
            const testBoard = board.map(r => [...r]);
            applyMoveToBoard(startR, startC, row, col, testBoard);
            
            if (isKingInCheck(currentPlayer, testBoard)) {
                selectedSquare = null;
                renderBoard();
                return;
            }
            
            // Apply move to real board
            const movingPiece = board[startR][startC];
            applyMoveToBoard(startR, startC, row, col, board);
            
            // UPDATE CASTLING RIGHTS
            if (movingPiece === 'K') { castlingRights.wK = false; castlingRights.wQ = false; }
            if (movingPiece === 'k') { castlingRights.bK = false; castlingRights.bQ = false; }
            if (movingPiece === 'R' && startC === 7) castlingRights.wK = false;
            if (movingPiece === 'R' && startC === 0) castlingRights.wQ = false;
            if (movingPiece === 'r' && startC === 7) castlingRights.bK = false;
            if (movingPiece === 'r' && startC === 0) castlingRights.bQ = false;

            // NEW: DETECT PROMOTION TRIGGER
            if (movingPiece === 'P' && row === 0) {
                pendingPromotion = { row, col, color: 'white' };
                showPromotionModal('white');
                selectedSquare = null;
                renderBoard();
                return; // PAUSE HERE - Wait for user selection
            } else if (movingPiece === 'p' && row === 7) {
                pendingPromotion = { row, col, color: 'black' };
                showPromotionModal('black');
                selectedSquare = null;
                renderBoard();
                return; // PAUSE HERE - Wait for user selection
            }

            // Normal move completion (runs if NO promotion triggered)
            finalizeTurn(movingPiece, startR, row, col);

        } else {
            selectedSquare = null;
        }
    } else {
        if (piece && isCurrentPlayerPiece) selectedSquare = { row, col };
    }
    renderBoard();
}

// Applies movement, including Castling and En Passant, to a board array
function applyMoveToBoard(startRow, startCol, endRow, endCol, b) {
    const piece = b[startRow][startCol];
    const type = piece.toLowerCase();
    
    // En Passant Capture
    if (type === 'p' && startCol !== endCol && b[endRow][endCol] === '') {
        b[startRow][endCol] = ''; 
    }

    // Castling
    if (type === 'k' && Math.abs(endCol - startCol) === 2) {
        if (endCol === 6) { 
            b[endRow][5] = b[endRow][7];
            b[endRow][7] = '';
        } else if (endCol === 2) { 
            b[endRow][3] = b[endRow][0];
            b[endRow][0] = '';
        }
    }

    // Execution
    b[endRow][endCol] = piece;
    b[startRow][startCol] = '';
}

// NEW: Populates and displays the modal
function showPromotionModal(color) {
    promoOptionsContainer.innerHTML = '';
    // Promotion types are Q, R, B, N. Pawns or Kings are invalid.
    const types = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    types.forEach(type => {
        const img = document.createElement('img');
        img.src = `images/${pieceImages[type]}`;
        img.className = 'promo-piece';
        // When clicked, finalize the promotion
        img.addEventListener('click', () => finalizePromotion(type));
        promoOptionsContainer.appendChild(img);
    });

    promotionModal.classList.remove('hidden');
}

// NEW: executes promotion, hides modal, and resumes game state checks
function finalizePromotion(promotedPieceType) {
    if (!pendingPromotion) return;

    // 1. Replace pawn with choice on real board
    board[pendingPromotion.row][pendingPromotion.col] = promotedPieceType;
    
    // 2. Clear temp state and hide modal
    const originalPawnColor = pendingPromotion.color; // needed for finalizeTurn check
    pendingPromotion = null;
    promotionModal.classList.add('hidden');
    
    // 3. Finalize the turn using the 'moved piece' as the NEW piece.
    // Note: startRow is technically arbitrary here as castling/enPassant handled earlier.
    // However, enPassantTarget logic requires knowing startRow. Since promo implies standard move was already applied:
    const tempStartRow = originalPawnColor === 'white' ? 1 : 6; 

    finalizeTurn(promotedPieceType, tempStartRow, pendingPromotion?.row || 0, pendingPromotion?.col || 0);
    renderBoard();
}

// NEW: Refactored shared logic to update turn state, check EP, Check, and Checkmate
function finalizeTurn(movingPiece, startR, endRow, endCol) {
    // UPDATE EN PASSANT TARGET based on the move just applied
    if (movingPiece.toLowerCase() === 'p' && Math.abs(endRow - startR) === 2) {
        enPassantTarget = { row: (endRow + startR) / 2, col: endCol };
    } else {
        enPassantTarget = null;
    }

    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    selectedSquare = null;
    
    // Post-move checks on real board
    if (isCheckmate(currentPlayer, board)) {
        statusDisplay.innerText = `Checkmate! ${currentPlayer === 'white' ? 'Black' : 'White'} Wins!`;
        gameOver = true;
    } else if (isKingInCheck(currentPlayer, board)) {
        statusDisplay.innerText = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn (Check!)`;
    } else {
        statusDisplay.innerText = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
    }
}

// ... rest of the helper functions from before (isValidMove, isPathClear, isKingInCheck, etc.) remain identical ...

function isValidMove(startRow, startCol, endRow, endCol, b) {
    const piece = b[startRow][startCol];
    const target = b[endRow][endCol];
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    
    if (target) {
        const isStartWhite = piece === piece.toUpperCase();
        const isTargetWhite = target === target.toUpperCase();
        if (isStartWhite === isTargetWhite) return false; // Can't capture own piece
    }

    const rowDiff = Math.abs(endRow - startRow);
    const colDiff = Math.abs(endCol - startCol);
    const type = piece.toLowerCase();

    switch (type) {
        case 'p':
            const direction = piece === 'P' ? -1 : 1;
            const startRank = piece === 'P' ? 6 : 1;
            
            if (colDiff === 0 && target === '') {
                if (endRow - startRow === direction) return true;
                if (startRow === startRank && endRow - startRow === direction * 2 && b[startRow + direction][startCol] === '') return true;
            }
            // Capture diagonal (Normal or En Passant)
            if (colDiff === 1 && endRow - startRow === direction) {
                if (target !== '') return true; 
                if (enPassantTarget && enPassantTarget.row === endRow && enPassantTarget.col === endCol) return true;
            }
            return false;

        case 'r':
            if (rowDiff !== 0 && colDiff !== 0) return false;
            return isPathClear(startRow, startCol, endRow, endCol, b);

        case 'n':
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);

        case 'b':
            if (rowDiff !== colDiff) return false;
            return isPathClear(startRow, startCol, endRow, endCol, b);

        case 'q':
            if (rowDiff !== 0 && colDiff !== 0 && rowDiff !== colDiff) return false;
            return isPathClear(startRow, startCol, endRow, endCol, b);

        case 'k':
            if (rowDiff <= 1 && colDiff <= 1) return true;
            
            // --- CASTLING LOGIC ---
            if (rowDiff === 0 && colDiff === 2 && !isKingInCheck(color, b)) {
                if (color === 'white') {
                    if (endCol === 6 && castlingRights.wK && isPathClear(7, 4, 7, 7, b) && !isSquareAttacked(7, 5, 'white', b)) return true;
                    if (endCol === 2 && castlingRights.wQ && isPathClear(7, 4, 7, 0, b) && !isSquareAttacked(7, 3, 'white', b)) return true;
                } else {
                    if (endCol === 6 && castlingRights.bK && isPathClear(0, 4, 0, 7, b) && !isSquareAttacked(0, 5, 'black', b)) return true;
                    if (endCol === 2 && castlingRights.bQ && isPathClear(0, 4, 0, 0, b) && !isSquareAttacked(0, 3, 'black', b)) return true;
                }
            }
            return false;
    }
    return false;
}

function isPathClear(startRow, startCol, endRow, endCol, b) {
    const rowStep = startRow === endRow ? 0 : (endRow > startRow ? 1 : -1);
    const colStep = startCol === endCol ? 0 : (endCol > startCol ? 1 : -1);

    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;

    while (currentRow !== endRow || currentCol !== endCol) {
        if (b[currentRow][currentCol] !== '') return false;
        currentRow += rowStep;
        currentCol += colStep;
    }
    return true;
}

function isSquareAttacked(targetRow, targetCol, defendingColor, b) {
    const attackerColor = defendingColor === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = b[r][c];
            if (piece) {
                const isWhite = piece === piece.toUpperCase();
                const isAttacker = (attackerColor === 'white' && isWhite) || (attackerColor === 'black' && !isWhite);
                
                // Prevent infinite recursion by skipping King check when verifying attacked squares
                if (isAttacker && piece.toLowerCase() !== 'k' && isValidMove(r, c, targetRow, targetCol, b)) {
                    return true;
                }
                // Manually check enemy king attacks
                if (isAttacker && piece.toLowerCase() === 'k') {
                    if (Math.abs(r - targetRow) <= 1 && Math.abs(c - targetCol) <= 1) return true;
                }
            }
        }
    }
    return false;
}

function findKing(color, b) {
    const kingChar = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] === kingChar) return { row: r, col: c };
        }
    }
}

function isKingInCheck(color, b) {
    const kingPos = findKing(color, b);
    return isSquareAttacked(kingPos.row, kingPos.col, color, b);
}

function isCheckmate(color, b) {
    if (!isKingInCheck(color, b)) return false;

    for (let startR = 0; startR < 8; startR++) {
        for (let startC = 0; startC < 8; startC++) {
            const piece = b[startR][startC];
            const isWhite = piece === piece.toUpperCase();
            
            if (piece && ((color === 'white' && isWhite) || (color === 'black' && !isWhite))) {
                for (let endR = 0; endR < 8; endR++) {
                    for (let endC = 0; endC < 8; endC++) {
                        if (isValidMove(startR, startC, endR, endC, b)) {
                            const testBoard = b.map(r => [...r]);
                            applyMoveToBoard(startR, startC, endR, endC, testBoard);
                            if (!isKingInCheck(color, testBoard)) return false; // Found an escape
                        }
                    }
                }
            }
        }
    }
    return true;
}

// Initialize the game
renderBoard();
