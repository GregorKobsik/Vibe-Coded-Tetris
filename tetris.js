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
        this.backgroundMusic = null;
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
        
        // Game statistics
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.startTime = null;
        this.piecesDropped = 0;
        
        // Game timing
        this.dropTimer = 0;
        this.dropInterval = 1000; // 1 second initially
        this.lastTime = 0;
        
        // Tetris pieces - All combinations of 1, 2, and 3 block pieces
        this.pieces = {
            // 1-block pieces
            DOT: {
                shape: [[1]],
                color: '#ff69b4' // Hot pink
            },
            
            // 2-block pieces
            I2_H: {
                shape: [[1, 1]], // Horizontal 2-block
                color: '#00ffff' // Cyan
            },
            I2_V: {
                shape: [
                    [1],
                    [1]
                ], // Vertical 2-block
                color: '#87ceeb' // Sky blue
            },
            
            // 3-block pieces
            I3_H: {
                shape: [[1, 1, 1]], // Horizontal 3-block
                color: '#00f5ff' // Light cyan
            },
            I3_V: {
                shape: [
                    [1],
                    [1],
                    [1]
                ], // Vertical 3-block
                color: '#4169e1' // Royal blue
            },
            L3: {
                shape: [
                    [1, 0],
                    [1, 1]
                ], // L-shaped 3-block
                color: '#ff8c00' // Dark orange
            },
            J3: {
                shape: [
                    [0, 1],
                    [1, 1]
                ], // J-shaped 3-block (mirror of L3)
                color: '#9370db' // Medium purple
            },
            
            // Original 4-block pieces (classic tetrominoes) - keeping for variety
            I4: {
                shape: [
                    [1, 1, 1, 1]
                ],
                color: '#00f5ff'
            },
            O4: {
                shape: [
                    [1, 1],
                    [1, 1]
                ],
                color: '#ffed00'
            },
            T4: {
                shape: [
                    [0, 1, 0],
                    [1, 1, 1]
                ],
                color: '#a000f0'
            },
            S4: {
                shape: [
                    [0, 1, 1],
                    [1, 1, 0]
                ],
                color: '#00f000'
            },
            Z4: {
                shape: [
                    [1, 1, 0],
                    [0, 1, 1]
                ],
                color: '#f00000'
            },
            J4: {
                shape: [
                    [1, 0, 0],
                    [1, 1, 1]
                ],
                color: '#0000f0'
            },
            L4: {
                shape: [
                    [0, 0, 1],
                    [1, 1, 1]
                ],
                color: '#f0a000'
            }
        };
        
        this.pieceTypes = Object.keys(this.pieces);
        
        this.setupEventListeners();
        this.generateInitialPieces();
        this.updateDisplay();
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Button controls
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('pauseButton').addEventListener('click', () => this.togglePause());
        document.getElementById('resetButton').addEventListener('click', () => this.resetGame());
    }
    
    handleKeyPress(e) {
        if (!this.gameRunning || this.paused || this.gameOver) {
            if (e.code === 'Space' && this.gameOver) {
                this.resetGame();
                this.startGame();
            }
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
        
        document.getElementById('startButton').disabled = true;
        document.getElementById('pauseButton').disabled = false;
        document.getElementById('gameOverlay').classList.add('hidden');
        
        // Play start sound
        this.playSound(523, 0.2, 'triangle', 0.2); // C5 note
        
        // Start background music
        this.startBackgroundMusic();
        
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
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.piecesDropped = 0;
        this.dropInterval = 1000;
        this.canHold = true;
        
        // Stop background music
        this.stopBackgroundMusic();
        
        // Clear board
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
        this.currentPiece = null;
        this.holdPiece = null;
        this.generateInitialPieces();
        
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
        document.getElementById('pauseButton').textContent = 'Pause';
        document.getElementById('gameOverlay').classList.add('hidden');
        
        this.updateDisplay();
        this.render();
    }
    
    generateInitialPieces() {
        // Generate initial queue of 3 pieces
        this.nextPieces = [];
        for (let i = 0; i < 3; i++) {
            this.nextPieces.push(this.createRandomPiece());
        }
        this.renderAllNextPieces();
        this.renderHoldPiece();
    }
    
    createRandomPiece() {
        const type = this.pieceTypes[Math.floor(Math.random() * this.pieceTypes.length)];
        return {
            type: type,
            shape: this.pieces[type].shape,
            color: this.pieces[type].color,
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
        
        // Check for game over
        if (this.isColliding(this.currentPiece, 0, 0)) {
            this.endGame();
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
        this.score += dropDistance * 2; // Bonus points for hard drop
        
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
        
        // Bonus points for smaller pieces (they're harder to place strategically)
        const sizeBonus = Math.max(0, 5 - blockCount); // 1-block = 4 bonus, 2-block = 3 bonus, etc.
        this.score += sizeBonus;
        
        // Play lock sound
        this.playSound(165, 0.1, 'triangle', 0.15);
        
        // Check for completed lines
        this.clearLines();
        
        // Spawn next piece
        this.spawnPiece();
    }
    
    clearLines() {
        let linesCleared = 0;
        let clearedRows = [];
        
        for (let y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                clearedRows.push(y);
                // Create line clear particles
                for (let x = 0; x < this.BOARD_WIDTH; x++) {
                    this.createParticles(
                        x * this.BLOCK_SIZE, 
                        y * this.BLOCK_SIZE, 
                        this.board[y][x], 
                        6
                    );
                }
                
                // Remove completed line
                this.board.splice(y, 1);
                // Add empty line at top
                this.board.unshift(Array(this.BOARD_WIDTH).fill(0));
                linesCleared++;
                y++; // Check same row again
            }
        }
        
        if (linesCleared > 0) {
            // Play line clear sound based on number of lines
            const frequencies = [0, 440, 523, 659, 880]; // None, single, double, triple, tetris
            this.playSound(frequencies[linesCleared] || 880, 0.3, 'triangle', 0.25);
            
            this.linesCleared += linesCleared;
            
            // Adjusted score calculation for smaller pieces gameplay
            const lineScores = [0, 20, 60, 180, 800]; // Reduced from original to balance smaller pieces
            this.score += lineScores[linesCleared] * this.level;
            
            // Level progression (every 15 lines instead of 10 to account for faster gameplay)
            const newLevel = Math.floor(this.linesCleared / 15) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.dropInterval = Math.max(30, 1000 - (this.level - 1) * 40); // Faster progression
                
                // Play level up sound
                this.playSound(698, 0.2, 'triangle', 0.2);
            }
            
            this.updateDisplay();
        }
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
        // Clear canvas
        this.ctx.fillStyle = '#000000';
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
        
        // Main block
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        
        // Highlight effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, 2);
        ctx.fillRect(pixelX, pixelY, 2, this.BLOCK_SIZE);
        
        // Shadow effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(pixelX, pixelY + this.BLOCK_SIZE - 2, this.BLOCK_SIZE, 2);
        ctx.fillRect(pixelX + this.BLOCK_SIZE - 2, pixelY, 2, this.BLOCK_SIZE);
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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
        
        // Calculate ghost position
        let ghostY = this.currentPiece.y;
        while (!this.isColliding(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        
        // Draw ghost piece
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const pixelX = (this.currentPiece.x + x) * this.BLOCK_SIZE;
                    const pixelY = (ghostY + y) * this.BLOCK_SIZE;
                    
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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
    
    renderHoldPiece() {
        if (!this.holdCtx || !this.holdCanvas) return;
        
        if (this.holdPiece) {
            this.renderPieceOnCanvas(this.holdCtx, this.holdCanvas, this.holdPiece, 18);
        } else {
            // Clear canvas if no hold piece
            this.holdCtx.fillStyle = '#000000';
            this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        }
    }
    
    renderPieceOnCanvas(ctx, canvas, piece, blockSize) {
        if (!piece) return;
        
        // Clear canvas
        ctx.fillStyle = '#000000';
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
                    
                    // Highlight
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.fillRect(pixelX, pixelY, blockSize, 2);
                    ctx.fillRect(pixelX, pixelY, 2, blockSize);
                    
                    // Border
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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
    
    // LoFi Background Music System
    startBackgroundMusic() {
        if (!this.audioContext) return;
        
        this.stopBackgroundMusic(); // Stop any existing music
        
        // Create nodes for the lofi effect
        this.musicGain = this.audioContext.createGain();
        this.musicGain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        this.musicGain.connect(this.audioContext.destination);
        
        // Create a simple lofi chord progression
        this.startLofiLoop();
    }
    
    startLofiLoop() {
        if (!this.audioContext || !this.musicGain) return;
        
        // Simple lofi chord progression in C minor
        const chords = [
            [261.63, 311.13, 369.99], // C minor (C-Eb-G)
            [246.94, 293.66, 349.23], // B diminished (B-D-F)
            [220.00, 261.63, 311.13], // A minor (A-C-E)
            [293.66, 349.23, 415.30]  // D minor (D-F-A)
        ];
        
        let chordIndex = 0;
        const chordDuration = 4; // 4 seconds per chord
        
        const playChord = () => {
            if (!this.audioContext || !this.musicGain) return;
            
            const chord = chords[chordIndex];
            const oscillators = [];
            
            // Create oscillators for each note in the chord
            chord.forEach((frequency, i) => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                // Different waveforms for lofi texture
                osc.type = i === 0 ? 'triangle' : (i === 1 ? 'sine' : 'sawtooth');
                osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                
                // Soft attack and release for lofi feel
                gain.gain.setValueAtTime(0, this.audioContext.currentTime);
                gain.gain.linearRampToValueAtTime(0.03 + i * 0.01, this.audioContext.currentTime + 0.1);
                gain.gain.setValueAtTime(0.03 + i * 0.01, this.audioContext.currentTime + chordDuration - 0.5);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + chordDuration);
                
                osc.connect(gain);
                gain.connect(this.musicGain);
                
                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + chordDuration);
                
                oscillators.push(osc);
            });
            
            // Add some subtle arpeggiation
            setTimeout(() => {
                if (!this.audioContext || !this.musicGain) return;
                
                const arpNote = this.audioContext.createOscillator();
                const arpGain = this.audioContext.createGain();
                
                arpNote.type = 'sine';
                arpNote.frequency.setValueAtTime(chord[0] * 2, this.audioContext.currentTime); // Octave higher
                
                arpGain.gain.setValueAtTime(0, this.audioContext.currentTime);
                arpGain.gain.linearRampToValueAtTime(0.02, this.audioContext.currentTime + 0.05);
                arpGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);
                
                arpNote.connect(arpGain);
                arpGain.connect(this.musicGain);
                
                arpNote.start(this.audioContext.currentTime);
                arpNote.stop(this.audioContext.currentTime + 1);
                
            }, Math.random() * 2000 + 1000); // Random timing for lofi feel
            
            chordIndex = (chordIndex + 1) % chords.length;
        };
        
        // Start the loop
        playChord();
        this.musicInterval = setInterval(playChord, chordDuration * 1000);
    }
    
    stopBackgroundMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        
        if (this.musicGain) {
            this.musicGain.disconnect();
            this.musicGain = null;
        }
    }
    
    playSound(frequency, duration = 0.1, type = 'sine', volume = 0.3) {
        if (!this.audioContext) return;
        
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
        document.getElementById('overlayMessage').textContent = message;
        document.getElementById('gameOverlay').classList.remove('hidden');
    }
    
    endGame() {
        this.gameOver = true;
        this.gameRunning = false;
        
        // Stop background music
        this.stopBackgroundMusic();
        
        // Play game over sound
        this.playSound(147, 0.5, 'sawtooth', 0.3); // D3 note
        
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
        
        this.showOverlay('Game Over', `Final Score: ${this.score.toLocaleString()} | Press SPACE to restart`);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.tetrisGame = new TetrisGame();
});
