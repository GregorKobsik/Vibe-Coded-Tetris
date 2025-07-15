// Tetris Game Implementation
class TetrisGame {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('gameBoard');
        this.ctx = this.canvas.getContext('2d');
        
        // Multiple next piece canvases
        this.nextCanvases = [
            { canvas: document.getElementById('nextPiece1'), ctx: null },
            { canvas: document.getElementById('nextPiece2'), ctx: null },
            { canvas: document.getElementById('nextPiece3'), ctx: null }
        ];
        
        // Initialize contexts with error checking
        this.nextCanvases.forEach((nc, index) => {
            if (nc.canvas) {
                nc.ctx = nc.canvas.getContext('2d');
            } else {
                console.warn(`nextPiece${index + 1} canvas not found`);
            }
        });
        
        // Hold piece canvas
        this.holdCanvas = document.getElementById('holdPiece');
        this.holdCtx = this.holdCanvas ? this.holdCanvas.getContext('2d') : null;
        
        // Particle effects canvas
        this.particleCanvas = document.getElementById('particleCanvas');
        this.particleCtx = this.particleCanvas ? this.particleCanvas.getContext('2d') : null;
        this.particles = [];
        
        // Audio setup
        this.audioContext = null;
        this.initAudio();
        
        // Game dimensions
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.BLOCK_SIZE = 30;
        
        // Initialize game state
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
        this.currentPiece = null;
        this.nextPieces = []; // Array of next 3 pieces
        this.holdPiece = null;
        this.canHold = true; // Prevents infinite hold swapping
        this.gameRunning = false;
        this.gameOver = false;
        this.paused = false;
        this.waitingForContinue = false;
        
        // Game statistics
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.startTime = null;
        this.piecesDropped = 0;
        
        // Track scoring per level
        this.levelScores = Array(5).fill(0); // Points gained per level (index 0 = level 1)
        this.levelRowPoints = 0; // Points from row completion in current level
        
        // Game timing
        this.dropTimer = 0;
        this.dropInterval = 1000; // 1 second initially
        this.lastTime = 0;
        
        // Matplotlib tab10 color palette (first 6 colors)
        this.colorPalette = [
            '#1f77b4', // Blue
            '#ff7f0e', // Orange
            '#2ca02c', // Green
            '#d62728', // Red
            '#9467bd', // Purple
            '#8c564b'  // Brown
        ];
        
        // Tetris pieces - All combinations of 1, 2, and 3 block pieces
        this.pieces = {
            // 1-block pieces
            DOT: {
                shape: [[1]]
            },
            
            // 2-block pieces
            I2_H: {
                shape: [[1, 1]] // Horizontal 2-block
            },
            I2_V: {
                shape: [
                    [1],
                    [1]
                ] // Vertical 2-block
            },
            
            // 3-block pieces
            I3_H: {
                shape: [[1, 1, 1]] // Horizontal 3-block
            },
            I3_V: {
                shape: [
                    [1],
                    [1],
                    [1]
                ] // Vertical 3-block
            },
            L3: {
                shape: [
                    [1, 0],
                    [1, 1]
                ] // L-shaped 3-block
            },
            J3: {
                shape: [
                    [0, 1],
                    [1, 1]
                ] // J-shaped 3-block (mirror of L3)
            },
            
            // Original 4-block pieces (classic tetrominoes) - keeping for variety
            I4: {
                shape: [
                    [1, 1, 1, 1]
                ]
            },
            O4: {
                shape: [
                    [1, 1],
                    [1, 1]
                ]
            },
            T4: {
                shape: [
                    [0, 1, 0],
                    [1, 1, 1]
                ]
            },
            S4: {
                shape: [
                    [0, 1, 1],
                    [1, 1, 0]
                ]
            },
            Z4: {
                shape: [
                    [1, 1, 0],
                    [0, 1, 1]
                ]
            },
            J4: {
                shape: [
                    [1, 0, 0],
                    [1, 1, 1]
                ]
            },
            L4: {
                shape: [
                    [0, 0, 1],
                    [1, 1, 1]
                ]
            }
        };
        
        this.pieceTypes = Object.keys(this.pieces);
        
        this.setupEventListeners();
        this.generateInitialPieces();
        this.updateDisplay();
        this.clearNextPiecesDisplay(); // Clear next pieces display initially
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Button controls
        document.getElementById('startInfoButton').addEventListener('click', () => this.startGameFromInfo());
        document.getElementById('pauseButton').addEventListener('click', () => this.togglePause());
        document.getElementById('resetButton').addEventListener('click', () => this.resetGame());
    }
    
    handleKeyPress(e) {
        // Handle level completion continue
        if (this.waitingForContinue) {
            this.waitingForContinue = false;
            this.paused = false; // Resume the game
            document.getElementById('gameOverlay').classList.add('hidden');
            
            // Clear board for next level and prepare game state
            this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
            this.currentPiece = null;
            this.holdPiece = null;
            this.generateInitialPieces();
            this.spawnPiece();
            
            // Restart the game loop
            this.gameLoop();
            return;
        }
        
        if (!this.gameRunning || this.paused || this.gameOver) {
            if (e.code === 'KeyP') {
                this.togglePause();
            }
            return;
        }
        
        switch (e.code) {
            case 'ArrowLeft':
                e.preventDefault();
                if (this.movePiece(-1, 0)) {
                    this.playSound(220, 0.05, 'square', 0.1); // Move sound
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (this.movePiece(1, 0)) {
                    this.playSound(220, 0.05, 'square', 0.1); // Move sound
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (this.movePiece(0, 1)) {
                    this.playSound(196, 0.05, 'square', 0.1); // Soft drop sound
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.rotatePiece();
                this.playSound(330, 0.1, 'triangle', 0.15); // Rotate sound
                break;
            case 'Space':
                e.preventDefault();
                this.hardDrop();
                break;
            case 'KeyP':
                e.preventDefault();
                this.togglePause();
                break;
            case 'KeyC':
                e.preventDefault();
                this.holdCurrentPiece();
                break;
        }
    }
    
    startGame() {
        // Initialize audio context on first user interaction
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.gameRunning = true;
        this.gameOver = false;
        this.paused = false;
        this.startTime = Date.now();
        
        document.getElementById('pauseButton').disabled = false;
        document.getElementById('gameOverlay').classList.add('hidden');
        
        // Play start sound
        this.playSound(523, 0.2, 'triangle', 0.2); // C5 note
        
        // Now show the next pieces since game is starting
        this.renderAllNextPieces();
        
        this.spawnPiece();
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning || this.gameOver) return;
        
        this.paused = !this.paused;
        document.getElementById('pauseButton').textContent = this.paused ? 'Resume' : 'Pause';
        
        if (this.paused) {
            this.showOverlay('Paused', 'Press P to resume');
        } else {
            document.getElementById('gameOverlay').classList.add('hidden');
            this.gameLoop();
        }
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gameOver = false;
        this.paused = false;
        this.waitingForContinue = false;
        this.score = 0;
        this.level = 1; // Start at level 1
        this.linesCleared = 0;
        this.piecesDropped = 0;
        this.dropInterval = 1000;
        this.canHold = true;
        
        // Reset level tracking
        this.levelScores = Array(5).fill(0);
        this.levelRowPoints = 0;
        
        // Clear board
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
        this.currentPiece = null;
        this.holdPiece = null;
        this.generateInitialPieces();
        
        document.getElementById('pauseButton').disabled = true;
        document.getElementById('pauseButton').textContent = 'Pause';
        document.getElementById('gameOverlay').classList.add('hidden');
        document.getElementById('infoOverlay').classList.remove('hidden');
        
        this.updateDisplay();
        this.render();
        this.clearNextPiecesDisplay(); // Clear next pieces when game is reset
    }
    
    generateInitialPieces() {
        // Generate initial queue of 3 pieces but don't render them yet
        this.nextPieces = [];
        for (let i = 0; i < 3; i++) {
            this.nextPieces.push(this.createRandomPiece());
        }
        // Don't render next pieces initially - only when game starts
        this.renderHoldPiece();
    }
    
    createRandomPiece() {
        const type = this.pieceTypes[Math.floor(Math.random() * this.pieceTypes.length)];
        
        // Determine number of colors available based on level (level 1: 2 colors, level 2: 3 colors, etc.)
        const availableColors = Math.min(this.level + 1, 6);
        const colorIndex = Math.floor(Math.random() * availableColors);
        const color = this.colorPalette[colorIndex];
        
        return {
            type: type,
            shape: this.pieces[type].shape,
            color: color,
            x: Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.pieces[type].shape[0].length / 2),
            y: 0
        };
    }
    
    getNextPiece() {
        // Get the first piece from queue and add a new one to the end
        const piece = this.nextPieces.shift();
        this.nextPieces.push(this.createRandomPiece());
        this.renderAllNextPieces();
        return piece;
    }
    
    spawnPiece() {
        this.currentPiece = this.getNextPiece();
        this.piecesDropped++;
        this.canHold = true; // Reset hold ability for new piece
        
        // Check for level completion (board is full - piece placed outside board)
        if (this.isColliding(this.currentPiece, 0, 0)) {
            this.completeLevel();
            return;
        }
    }
    
    movePiece(dx, dy) {
        if (!this.currentPiece || this.isColliding(this.currentPiece, dx, dy)) {
            return false;
        }
        
        this.currentPiece.x += dx;
        this.currentPiece.y += dy;
        return true;
    }
    
    rotatePiece() {
        if (!this.currentPiece) return;
        
        const rotated = this.rotateMatrix(this.currentPiece.shape);
        const originalShape = this.currentPiece.shape;
        
        this.currentPiece.shape = rotated;
        
        // Wall kicks - try to adjust position if rotation causes collision
        const kicks = [
            [0, 0],   // No adjustment
            [-1, 0],  // Move left
            [1, 0],   // Move right
            [0, -1],  // Move up
            [-1, -1], // Move left and up
            [1, -1]   // Move right and up
        ];
        
        for (let [dx, dy] of kicks) {
            if (!this.isColliding(this.currentPiece, dx, dy)) {
                this.currentPiece.x += dx;
                this.currentPiece.y += dy;
                return;
            }
        }
        
        // If no valid position found, revert rotation
        this.currentPiece.shape = originalShape;
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotated[j][rows - 1 - i] = matrix[i][j];
            }
        }
        
        return rotated;
    }
    
    holdCurrentPiece() {
        if (!this.currentPiece || !this.canHold) return;
        
        // Play hold sound
        this.playSound(294, 0.1, 'triangle', 0.15); // D4 note
        
        if (this.holdPiece === null) {
            // First time holding - store current piece and spawn next
            this.holdPiece = {
                type: this.currentPiece.type,
                shape: this.pieces[this.currentPiece.type].shape,
                color: this.currentPiece.color
            };
            this.spawnPiece();
        } else {
            // Swap current piece with held piece
            const tempPiece = {
                type: this.holdPiece.type,
                shape: this.holdPiece.shape,
                color: this.holdPiece.color,
                x: Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.holdPiece.shape[0].length / 2),
                y: 0
            };
            
            this.holdPiece = {
                type: this.currentPiece.type,
                shape: this.pieces[this.currentPiece.type].shape,
                color: this.currentPiece.color
            };
            
            this.currentPiece = tempPiece;
        }
        
        this.canHold = false; // Prevent infinite swapping
        this.renderHoldPiece();
    }
    
    hardDrop() {
        if (!this.currentPiece) return;
        
        let dropDistance = 0;
        while (!this.isColliding(this.currentPiece, 0, dropDistance + 1)) {
            dropDistance++;
        }
        
        this.currentPiece.y += dropDistance;
        
        // Play hard drop sound
        this.playSound(130, 0.2, 'sawtooth', 0.2);
        
        this.lockPiece();
    }
    
    isColliding(piece, dx = 0, dy = 0) {
        const newX = piece.x + dx;
        const newY = piece.y + dy;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const boardX = newX + x;
                    const boardY = newY + y;
                    
                    // Check boundaries
                    if (boardX < 0 || boardX >= this.BOARD_WIDTH || 
                        boardY >= this.BOARD_HEIGHT) {
                        return true;
                    }
                    
                    // Check board collision (skip if above board)
                    if (boardY >= 0 && this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    lockPiece() {
        if (!this.currentPiece) return;
        
        // Calculate piece size for bonus scoring
        let blockCount = 0;
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    blockCount++;
                }
            }
        }
        
        // Create particles when piece locks
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const boardY = this.currentPiece.y + y;
                    const boardX = this.currentPiece.x + x;
                    
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = this.currentPiece.color;
                        
                        // Create small particles when piece locks
                        this.createParticles(
                            boardX * this.BLOCK_SIZE, 
                            boardY * this.BLOCK_SIZE, 
                            this.currentPiece.color, 
                            3
                        );
                    }
                }
            }
        }
        
        // Play lock sound
        this.playSound(165, 0.1, 'triangle', 0.15);
        
        // Check for completed rows (but don't remove them)
        this.checkCompletedRows();
        
        // Spawn next piece
        this.spawnPiece();
    }
    
    checkCompletedRows() {
        let newlyCompletedRows = 0;
        const rowsToCheck = [];
        
        // Only check rows where the current piece was placed
        if (this.currentPiece) {
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                const boardY = this.currentPiece.y + y;
                if (boardY >= 0 && boardY < this.BOARD_HEIGHT) {
                    rowsToCheck.push(boardY);
                }
            }
        }
        
        // Check only the rows affected by the current piece placement
        for (let boardY of rowsToCheck) {
            if (this.board[boardY].every(cell => cell !== 0)) {
                newlyCompletedRows++;
                
                // Create celebration particles for newly completed row
                for (let x = 0; x < this.BOARD_WIDTH; x++) {
                    this.createParticles(
                        x * this.BLOCK_SIZE, 
                        boardY * this.BLOCK_SIZE, 
                        this.board[boardY][x], 
                        6
                    );
                }
            }
        }
        
        if (newlyCompletedRows > 0) {
            // Play completion sound based on number of rows
            const frequencies = [0, 440, 523, 659, 880]; // None, single, double, triple, tetris
            this.playSound(frequencies[newlyCompletedRows] || 880, 0.3, 'triangle', 0.25);
            
            this.linesCleared += newlyCompletedRows;
            
            // Enhanced scoring system for multiple simultaneous rows
            let rowScore = 0;
            
            if (newlyCompletedRows === 1) {
                rowScore = 10; // Fixed 10 points for single row
            } else if (newlyCompletedRows === 2) {
                rowScore = 60; // Fixed 60 points for double
            } else if (newlyCompletedRows === 3) {
                rowScore = 120; // Fixed 120 points for triple
            } else if (newlyCompletedRows >= 4) {
                rowScore = 200; // Fixed 200 points for tetris+
            }
            
            this.score += rowScore;
            this.levelRowPoints += rowScore; // Track row points for current level
            
            this.updateDisplay();
        }
    }
    
    completeLevel() {
        // Calculate bonus points for connected regions before clearing the board
        const regionBonus = this.calculateConnectedRegionBonus();
        this.score += regionBonus;
        
        // Store total points gained in this level (before incrementing level)
        const levelIndex = this.level - 1; // Convert to 0-based index
        this.levelScores[levelIndex] = this.levelRowPoints + regionBonus;
        
        // Level completed when board is full
        this.level++;
        
        // Play level completion sound
        this.playSound(698, 0.4, 'triangle', 0.3);
        
        if (this.level > 5) {
            // Game completed after 5 levels
            this.endGame();
            return;
        }
        
        // Show level completion overlay with bonus information (keep board visible)
        const bonusText = regionBonus > 0 ? `Region Bonus: +${regionBonus.toLocaleString()}` : '';
        let message = `Starting Level ${this.level}<br><br>Score: ${this.score.toLocaleString()}<br>Completed Rows: +${this.levelRowPoints}`;
        if (bonusText) {
            message += `<br>${bonusText}`;
        }
        message += `<br><br>Press any key to continue`;
        this.showOverlay(`Level ${this.level - 1} Complete!`, message);
        
        // Reset row points for next level
        this.levelRowPoints = 0;
        
        // Pause the game while showing level complete message
        this.paused = true;
        
        // Set flag to wait for user input before continuing
        this.waitingForContinue = true;
        
        this.updateDisplay();
        this.render();
        this.clearNextPiecesDisplay();
        this.renderAllNextPieces();
    }

    gameLoop(currentTime = 0) {
        if (!this.gameRunning || this.paused || this.gameOver) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.dropTimer += deltaTime;
        
        // Drop piece if timer expired
        if (this.dropTimer >= this.dropInterval) {
            if (!this.movePiece(0, 1)) {
                this.lockPiece();
            }
            this.dropTimer = 0;
        }
        
        this.updateGameTime();
        this.updateParticles();
        this.render();
        this.renderParticles();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    updateGameTime() {
        if (!this.startTime) return;
        
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        document.getElementById('gameTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Calculate pieces per second
        const pps = this.piecesDropped / (elapsed / 1000);
        document.getElementById('piecesPerSecond').textContent = pps.toFixed(1);
    }
    
    updateDisplay() {
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.linesCleared;
    }
    
    render() {
        // Clear canvas with appropriate background color
        const isLightMode = document.body.classList.contains('light-mode');
        this.ctx.fillStyle = isLightMode ? '#e8e8e8' : '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    this.drawBlock(this.ctx, x, y, this.board[y][x]);
                }
            }
        }
        
        // Draw current piece
        if (this.currentPiece) {
            this.drawPiece(this.ctx, this.currentPiece);
        }
        
        // Draw ghost piece (preview of where piece will land)
        if (this.currentPiece) {
            this.drawGhostPiece();
        }
        
        // Draw grid
        this.drawGrid();
        
        // Render particles
        this.renderParticles();
    }
    
    drawBlock(ctx, x, y, color) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        const isLightMode = document.body.classList.contains('light-mode');
        
        // Main block
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        
        // Highlight effect - adjust for light mode
        ctx.fillStyle = isLightMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, 2);
        ctx.fillRect(pixelX, pixelY, 2, this.BLOCK_SIZE);
        
        // Shadow effect - adjust for light mode
        ctx.fillStyle = isLightMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(pixelX, pixelY + this.BLOCK_SIZE - 2, this.BLOCK_SIZE, 2);
        ctx.fillRect(pixelX + this.BLOCK_SIZE - 2, pixelY, 2, this.BLOCK_SIZE);
        
        // Border - use middle gray for light mode, light for dark mode
        ctx.strokeStyle = isLightMode ? 'rgba(128, 128, 128, 0.6)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
    }
    
    drawPiece(ctx, piece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    this.drawBlock(ctx, piece.x + x, piece.y + y, piece.color);
                }
            }
        }
    }
    
    drawGhostPiece() {
        if (!this.currentPiece) return;
        
        const isLightMode = document.body.classList.contains('light-mode');
        
        // Calculate ghost position
        let ghostY = this.currentPiece.y;
        while (!this.isColliding(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        
        // Draw ghost piece with appropriate colors for light/dark mode
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const pixelX = (this.currentPiece.x + x) * this.BLOCK_SIZE;
                    const pixelY = (ghostY + y) * this.BLOCK_SIZE;
                    
                    // Fill with appropriate transparency for light/dark mode
                    this.ctx.fillStyle = isLightMode ? 'rgba(128, 128, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)';
                    this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                    
                    // Border with appropriate color for light/dark mode
                    this.ctx.strokeStyle = isLightMode ? 'rgba(128, 128, 128, 0.5)' : 'rgba(255, 255, 255, 0.3)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
    }
    
    drawGrid() {
        const isLightMode = document.body.classList.contains('light-mode');
        this.ctx.strokeStyle = isLightMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.BOARD_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(x * this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, y * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
    }
    
    renderAllNextPieces() {
        for (let i = 0; i < 3 && i < this.nextPieces.length; i++) {
            if (this.nextCanvases[i] && this.nextCanvases[i].ctx) {
                this.renderPieceOnCanvas(
                    this.nextCanvases[i].ctx, 
                    this.nextCanvases[i].canvas, 
                    this.nextPieces[i],
                    i === 0 ? 18 : (i === 1 ? 15 : 12) // Different block sizes
                );
            }
        }
    }
    
    clearNextPiecesDisplay() {
        // Clear all next piece canvases with appropriate background color
        const isLightMode = document.body.classList.contains('light-mode');
        const bgColor = isLightMode ? '#e8e8e8' : '#000000';
        
        for (let i = 0; i < 3; i++) {
            if (this.nextCanvases[i] && this.nextCanvases[i].ctx && this.nextCanvases[i].canvas) {
                this.nextCanvases[i].ctx.fillStyle = bgColor;
                this.nextCanvases[i].ctx.fillRect(0, 0, this.nextCanvases[i].canvas.width, this.nextCanvases[i].canvas.height);
            }
        }
    }
    
    renderHoldPiece() {
        if (!this.holdCtx || !this.holdCanvas) return;
        
        if (this.holdPiece) {
            this.renderPieceOnCanvas(this.holdCtx, this.holdCanvas, this.holdPiece, 18);
        } else {
            // Clear canvas if no hold piece with appropriate background color
            const isLightMode = document.body.classList.contains('light-mode');
            this.holdCtx.fillStyle = isLightMode ? '#e8e8e8' : '#000000';
            this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        }
    }
    
    renderPieceOnCanvas(ctx, canvas, piece, blockSize) {
        if (!piece) return;
        
        // Clear canvas with appropriate background color
        const isLightMode = document.body.classList.contains('light-mode');
        ctx.fillStyle = isLightMode ? '#e8e8e8' : '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Center the piece in the canvas
        const startX = (canvas.width - piece.shape[0].length * blockSize) / 2;
        const startY = (canvas.height - piece.shape.length * blockSize) / 2;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const pixelX = startX + x * blockSize;
                    const pixelY = startY + y * blockSize;
                    
                    // Main block
                    ctx.fillStyle = piece.color;
                    ctx.fillRect(pixelX, pixelY, blockSize, blockSize);
                    
                    // Highlight - adjust for light mode
                    ctx.fillStyle = isLightMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
                    ctx.fillRect(pixelX, pixelY, blockSize, 2);
                    ctx.fillRect(pixelX, pixelY, 2, blockSize);
                    
                    // Border - use middle gray for light mode, light for dark mode
                    ctx.strokeStyle = isLightMode ? 'rgba(128, 128, 128, 0.6)' : 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pixelX, pixelY, blockSize, blockSize);
                }
            }
        }
    }
    
    // Audio system for minimalistic sound effects
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    playSound(frequency, duration = 0.1, type = 'sine', volume = 0.3) {
        if (!this.audioContext || !window.audioEnabled) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    // Particle system for visual effects
    createParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + Math.random() * this.BLOCK_SIZE,
                y: y + Math.random() * this.BLOCK_SIZE,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: color,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                size: 2 + Math.random() * 3
            });
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // gravity
            particle.life -= particle.decay;
            return particle.life > 0;
        });
    }
    
    renderParticles() {
        if (!this.particleCtx || !this.particleCanvas) return;
        
        this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height);
        
        this.particles.forEach(particle => {
            this.particleCtx.save();
            this.particleCtx.globalAlpha = particle.life;
            this.particleCtx.fillStyle = particle.color;
            this.particleCtx.beginPath();
            this.particleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.particleCtx.fill();
            this.particleCtx.restore();
        });
    }
    
    showOverlay(title, message) {
        document.getElementById('overlayTitle').textContent = title;
        document.getElementById('overlayMessage').innerHTML = message;
        document.getElementById('gameOverlay').classList.remove('hidden');
    }
    
    startGameFromInfo() {
        document.getElementById('infoOverlay').classList.add('hidden');
        this.startGame();
    }
    
    startNewGame() {
        this.resetGame();
        this.startGameFromInfo();
    }
    
    endGame() {
        this.gameOver = true;
        this.gameRunning = false;
        
        // Store final level score if game ended mid-level
        if (this.level <= 5) {
            const levelIndex = this.level - 1;
            this.levelScores[levelIndex] = this.levelRowPoints;
        }
        
        // Clear next pieces display when game ends
        this.clearNextPiecesDisplay();
        
        // Play game over sound
        this.playSound(147, 0.5, 'sawtooth', 0.3); // D3 note
        
        document.getElementById('pauseButton').disabled = true;
        
        // Create detailed score breakdown
        let levelBreakdown = '';
        for (let i = 0; i < 5; i++) {
            if (this.levelScores[i] > 0 || i < this.level - 1) {
                levelBreakdown += `Level ${i + 1}: ${this.levelScores[i].toLocaleString()} points<br>`;
            }
        }
        
        // Show appropriate message based on whether all levels were completed
        if (this.level > 5) {
            const message = `🎉 All 5 levels completed! 🎉<br><br>Final Score: ${this.score.toLocaleString()}<br><br>Points by Level:<br>${levelBreakdown}<br><button onclick="window.tetrisGame.startNewGame()" class="game-button" style="margin-top: 15px;">Start New Game</button>`;
            this.showOverlay('Game Over!', message);
        } else {
            const message = `Game Over - Level ${this.level}<br><br>Final Score: ${this.score.toLocaleString()}<br><br>Points by Level:<br>${levelBreakdown}<br><button onclick="window.tetrisGame.startNewGame()" class="game-button" style="margin-top: 15px;">Start New Game</button>`;
            this.showOverlay('Game Over', message);
        }
    }
    
    calculateConnectedRegionBonus() {
        // Create a map to store the largest region size for each color
        const colorRegions = new Map();
        const visited = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(false));
        
        // Find all connected regions using flood fill algorithm
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (!visited[y][x] && this.board[y][x] !== 0) {
                    const color = this.board[y][x];
                    const regionSize = this.floodFill(x, y, color, visited);
                    
                    // Track the largest region for each color
                    if (!colorRegions.has(color) || regionSize > colorRegions.get(color)) {
                        colorRegions.set(color, regionSize);
                    }
                }
            }
        }
        
        // Calculate bonus using similar scoring to row completion
        // Base score of 20 points per block in largest regions, scaled by level
        const baseScore = 20;
        let totalBonus = 0;
        
        for (let [color, largestRegion] of colorRegions) {
            // Award points similar to row completion: base score per block * level
            totalBonus += largestRegion * baseScore * this.level;
        }
        
        return totalBonus;
    }
    
    floodFill(startX, startY, targetColor, visited) {
        // Boundary checks
        if (startX < 0 || startX >= this.BOARD_WIDTH || 
            startY < 0 || startY >= this.BOARD_HEIGHT ||
            visited[startY][startX] || 
            this.board[startY][startX] !== targetColor) {
            return 0;
        }
        
        // Mark as visited
        visited[startY][startX] = true;
        let regionSize = 1;
        
        // Recursively check all 4 directions (up, down, left, right)
        const directions = [
            [0, -1], // up
            [0, 1],  // down
            [-1, 0], // left
            [1, 0]   // right
        ];
        
        for (let [dx, dy] of directions) {
            regionSize += this.floodFill(startX + dx, startY + dy, targetColor, visited);
        }
        
        return regionSize;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.tetrisGame = new TetrisGame();
});

// Audio Toggle Functionality
window.audioEnabled = true;

function toggleAudio() {
    const audioToggle = document.getElementById('audioToggle');
    window.audioEnabled = !window.audioEnabled;
    
    if (window.audioEnabled) {
        audioToggle.classList.add('active');
    } else {
        audioToggle.classList.remove('active');
    }
}

// Theme Toggle Functionality
function toggleTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const themeText = document.getElementById('themeText');
    const body = document.body;
    
    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        themeToggle.classList.remove('active');
        themeText.textContent = 'Dark Mode';
    } else {
        body.classList.add('light-mode');
        themeToggle.classList.add('active');
        themeText.textContent = 'Light Mode';
    }
    
    // Refresh canvas backgrounds when theme changes
    if (window.tetrisGame) {
        // Re-render the main game board
        window.tetrisGame.render();
        
        // Re-render hold piece
        window.tetrisGame.renderHoldPiece();
        
        // Re-render next pieces if game is running
        if (window.tetrisGame.gameRunning) {
            window.tetrisGame.renderAllNextPieces();
        } else {
            // Clear next pieces display with new theme colors
            window.tetrisGame.clearNextPiecesDisplay();
        }
    }
}

// Panel Toggle Functionality
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const toggleIcon = document.getElementById('controls-toggle');
    
    if (panel && toggleIcon) {
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            toggleIcon.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
        } else {
            panel.classList.add('collapsed');
            toggleIcon.classList.add('collapsed');
            toggleIcon.textContent = '▶';
        }
    }
}

// Initialize toggles on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set initial audio toggle state
    const audioToggle = document.getElementById('audioToggle');
    if (window.audioEnabled) {
        audioToggle.classList.add('active');
    }
    
    // Set initial theme toggle state (default to dark mode)
    const themeToggle = document.getElementById('themeToggle');
    // Keep dark mode as default, so toggle starts inactive
});
