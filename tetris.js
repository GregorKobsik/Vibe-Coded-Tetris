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
        
        // Row illumination effects
        this.illuminationEffects = [];
        
        // Level completion region animation
        this.regionAnimations = [];
        this.scoreDisplays = [];
        this.levelAnimationActive = false;
        this.isFinalLevelAnimation = false;
        
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
        const completedRows = [];
        for (let boardY of rowsToCheck) {
            if (this.board[boardY].every(cell => cell !== 0)) {
                newlyCompletedRows++;
                completedRows.push(boardY);
            }
        }
        
        if (newlyCompletedRows > 0) {
            // Create illumination effects for completed rows
            for (let boardY of completedRows) {
                this.createRowIllumination(boardY);
                
                // Create celebration particles for completed row
                for (let x = 0; x < this.BOARD_WIDTH; x++) {
                    this.createParticles(
                        x * this.BLOCK_SIZE, 
                        boardY * this.BLOCK_SIZE, 
                        this.board[boardY][x], 
                        6
                    );
                }
            }
            
            // Calculate row score
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
            
            // Create score display for completed rows
            if (completedRows.length > 0) {
                // Calculate center position of completed rows
                const centerY = completedRows.reduce((sum, row) => sum + row, 0) / completedRows.length;
                const centerX = this.BOARD_WIDTH / 2;
                
                this.createRowScoreDisplay(centerX, centerY, rowScore);
            }
            
            // Play completion sound based on number of rows
            const frequencies = [0, 440, 523, 659, 880]; // None, single, double, triple, tetris
            this.playSound(frequencies[newlyCompletedRows] || 880, 0.3, 'triangle', 0.25);
            
            this.linesCleared += newlyCompletedRows;
            
            this.score += rowScore;
            this.levelRowPoints += rowScore; // Track row points for current level
            
            this.updateDisplay();
        }
    }
    
    completeLevel() {
        // Calculate bonus points for connected regions before clearing the board
        const regionData = this.calculateConnectedRegionBonusWithDetails();
        const regionBonus = regionData.totalBonus;
        this.score += regionBonus;
        
        // Store total points gained in this level (before incrementing level)
        const levelIndex = this.level - 1; // Convert to 0-based index
        this.levelScores[levelIndex] = this.levelRowPoints + regionBonus;
        
        // Level completed when board is full
        this.level++;
        
        // Play level completion sound
        this.playSound(698, 0.4, 'triangle', 0.3);
        
        // Check if this is the final level (level 5 completed, now level 6)
        const isFinalLevel = this.level > 5;
        
        // Start the region animation if there are regions to highlight
        if (regionData.regions.length > 0) {
            this.startRegionAnimation(regionData.regions, isFinalLevel);
            // Pause the game during animation
            this.paused = true;
        } else {
            // No regions to animate, handle completion immediately
            if (isFinalLevel) {
                this.endGame();
            } else {
                this.showLevelCompleteOverlay(regionBonus);
            }
        }
        
        // Reset row points for next level
        this.levelRowPoints = 0;
        
        this.updateDisplay();
        this.render();
        this.clearNextPiecesDisplay();
        this.renderAllNextPieces();
    }

    // Row illumination effect system
    createRowIllumination(rowIndex) {
        this.illuminationEffects.push({
            row: rowIndex,
            progress: 0, // 0 to 1 - tracks the sweep from left to right
            intensity: 1.0, // brightness that fades out
            maxIntensity: 0.8,
            speed: 0.15, // how fast the sweep moves (much faster - almost instant)
            fadeSpeed: 0.015, // how fast it fades after sweeping
            sweepComplete: false
        });
    }
    
    updateIlluminationEffects() {
        this.illuminationEffects = this.illuminationEffects.filter(effect => {
            // Update progress (sweep from left to right)
            if (!effect.sweepComplete) {
                effect.progress += effect.speed;
                if (effect.progress >= 1.0) {
                    effect.progress = 1.0;
                    effect.sweepComplete = true;
                }
            } else {
                // After sweep is complete, fade out
                effect.intensity -= effect.fadeSpeed;
            }
            
            // Remove effect when fully faded
            return effect.intensity > 0;
        });
    }
    
    renderIlluminationEffects() {
        if (!this.ctx || this.illuminationEffects.length === 0) return;
        
        this.illuminationEffects.forEach(effect => {
            const rowY = effect.row * this.BLOCK_SIZE;
            const isLightMode = document.body.classList.contains('light-mode');
            
            // Create the sweep effect
            if (!effect.sweepComplete) {
                // Current position of the sweep
                const sweepX = effect.progress * this.canvas.width;
                const sweepWidth = 60; // Width of the bright sweep
                
                // Create gradient for the sweep effect
                const gradient = this.ctx.createLinearGradient(
                    sweepX - sweepWidth, rowY,
                    sweepX + sweepWidth, rowY
                );
                
                // Colors for the illumination sweep
                const centerColor = isLightMode ? 
                    `rgba(255, 255, 255, ${effect.intensity * effect.maxIntensity})` :
                    `rgba(255, 255, 255, ${effect.intensity * effect.maxIntensity})`;
                const edgeColor = isLightMode ?
                    `rgba(255, 255, 255, 0)` :
                    `rgba(255, 255, 255, 0)`;
                
                gradient.addColorStop(0, edgeColor);
                gradient.addColorStop(0.5, centerColor);
                gradient.addColorStop(1, edgeColor);
                
                // Draw the sweep
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(
                    Math.max(0, sweepX - sweepWidth), 
                    rowY, 
                    Math.min(this.canvas.width, sweepWidth * 2), 
                    this.BLOCK_SIZE
                );
            } else {
                // After sweep: gentle glow effect that fades out
                const glowIntensity = effect.intensity * 0.3;
                const glowColor = isLightMode ?
                    `rgba(255, 255, 255, ${glowIntensity})` :
                    `rgba(255, 255, 255, ${glowIntensity})`;
                
                this.ctx.fillStyle = glowColor;
                this.ctx.fillRect(0, rowY, this.canvas.width, this.BLOCK_SIZE);
            }
        });
    }

    gameLoop(currentTime = 0) {
        // Stop the game loop only if the game is not running and no animations are active
        if (!this.gameRunning && !this.levelAnimationActive) return;
        
        // Always update and render animations and time, even when paused
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.updateGameTime();
        this.updateParticles();
        this.updateIlluminationEffects();
        this.updateRegionAnimations(); // Always update region animations
        this.render();
        this.renderParticles();
        
        // Only update game logic if not paused, not game over, and game is running
        if (this.gameRunning && !this.paused && !this.gameOver) {
            this.dropTimer += deltaTime;
            
            // Drop piece if timer expired
            if (this.dropTimer >= this.dropInterval) {
                if (!this.movePiece(0, 1)) {
                    this.lockPiece();
                }
                this.dropTimer = 0;
            }
        }
        
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
        
        // Draw illumination effects (after board, before current piece)
        this.renderIlluminationEffects();
        
        // Draw region animations (level completion highlights) - but not score displays yet
        this.renderRegionHighlightsOnly();
        
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
        
        // Render score displays on top of everything else
        this.renderScoreDisplaysOnly();
    }
    
    drawBlock(ctx, x, y, color) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        const isLightMode = document.body.classList.contains('light-mode');
        const size = this.BLOCK_SIZE;
        const radius = 4; // Corner radius for modern rounded look
        
        // Apply transparency in light mode
        if (isLightMode) {
            ctx.globalAlpha = 0.9; // 10% transparency in light mode
        }
        
        // Save context for clip path
        ctx.save();
        
        // Create rounded rectangle path
        this.drawRoundedRect(ctx, pixelX, pixelY, size, size, radius);
        ctx.clip();
        
        // Create radial gradient for 3D depth effect
        const gradient = ctx.createRadialGradient(
            pixelX + size * 0.3, pixelY + size * 0.3, 0,
            pixelX + size * 0.5, pixelY + size * 0.5, size * 0.8
        );
        
        // Parse the hex color to create lighter and darker variants
        const rgb = this.hexToRgb(color);
        
        // In dark mode, reduce saturation and brightness to make pieces less vibrant
        let adjustedRgb = rgb;
        if (!isLightMode) {
            // Reduce saturation by blending with gray and reduce brightness in dark mode
            const desaturationFactor = 0.3; // Blend 30% with gray
            const brightnessFactor = 0.85; // Reduce brightness to 85%
            const gray = (rgb.r + rgb.g + rgb.b) / 3;
            
            adjustedRgb = {
                r: Math.round((rgb.r * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                g: Math.round((rgb.g * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                b: Math.round((rgb.b * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor)
            };
        }
        
        const lightVariant = `rgb(${Math.min(255, adjustedRgb.r + 40)}, ${Math.min(255, adjustedRgb.g + 40)}, ${Math.min(255, adjustedRgb.b + 40)})`;
        const darkVariant = `rgb(${Math.max(0, adjustedRgb.r - 30)}, ${Math.max(0, adjustedRgb.g - 30)}, ${Math.max(0, adjustedRgb.b - 30)})`;
        const baseColor = `rgb(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b})`;
        
        gradient.addColorStop(0, lightVariant);
        gradient.addColorStop(0.6, baseColor);
        gradient.addColorStop(1, darkVariant);
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(pixelX, pixelY, size, size);
        
        // Add inner glow effect
        const innerGradient = ctx.createRadialGradient(
            pixelX + size * 0.5, pixelY + size * 0.5, 0,
            pixelX + size * 0.5, pixelY + size * 0.5, size * 0.4
        );
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = innerGradient;
        ctx.fillRect(pixelX, pixelY, size, size);
        
        // Restore context to remove clip
        ctx.restore();
        
        // Enhanced 3D beveled edges
        const bevelSize = 3;
        const highlightIntensity = isLightMode ? 0.7 : 0.4;
        const shadowIntensity = isLightMode ? 0.6 : 0.4;
        
        // Top highlight bevel
        this.drawBevelEdge(ctx, pixelX, pixelY, size, bevelSize, 'top', 
            `rgba(255, 255, 255, ${highlightIntensity})`, radius);
        
        // Left highlight bevel
        this.drawBevelEdge(ctx, pixelX, pixelY, size, bevelSize, 'left', 
            `rgba(255, 255, 255, ${highlightIntensity * 0.8})`, radius);
        
        // Bottom shadow bevel
        this.drawBevelEdge(ctx, pixelX, pixelY, size, bevelSize, 'bottom', 
            `rgba(0, 0, 0, ${shadowIntensity})`, radius);
        
        // Right shadow bevel
        this.drawBevelEdge(ctx, pixelX, pixelY, size, bevelSize, 'right', 
            `rgba(0, 0, 0, ${shadowIntensity * 0.8})`, radius);
        
        // Subtle outer border for definition
        ctx.strokeStyle = isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, pixelX + 0.5, pixelY + 0.5, size - 1, size - 1, radius);
        ctx.stroke();
        
        // Reset global alpha if it was changed
        if (isLightMode) {
            ctx.globalAlpha = 1.0;
        }
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
        
        // Draw ghost piece with modern 3D style but transparent
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    this.drawGhostBlock(this.ctx, this.currentPiece.x + x, ghostY + y, this.currentPiece.color);
                }
            }
        }
    }
    
    drawGhostBlock(ctx, x, y, originalColor) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        const isLightMode = document.body.classList.contains('light-mode');
        const size = this.BLOCK_SIZE;
        const radius = 4; // Same radius as regular blocks
        
        // Save context for clip path
        ctx.save();
        
        // Create rounded rectangle path
        this.drawRoundedRect(ctx, pixelX, pixelY, size, size, radius);
        ctx.clip();
        
        // Create a subtle gradient for ghost piece
        const gradient = ctx.createRadialGradient(
            pixelX + size * 0.3, pixelY + size * 0.3, 0,
            pixelX + size * 0.5, pixelY + size * 0.5, size * 0.8
        );
        
        // Use the original piece color but with very low opacity
        const rgb = this.hexToRgb(originalColor);
        
        // In dark mode, also desaturate the ghost piece color for consistency
        let adjustedRgb = rgb;
        if (!isLightMode) {
            const desaturationFactor = 0.3;
            const brightnessFactor = 0.85;
            const gray = (rgb.r + rgb.g + rgb.b) / 3;
            
            adjustedRgb = {
                r: Math.round((rgb.r * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                g: Math.round((rgb.g * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                b: Math.round((rgb.b * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor)
            };
        }
        
        const ghostAlpha = isLightMode ? 0.15 : 0.12;
        const lightGhost = `rgba(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b}, ${ghostAlpha * 1.3})`;
        const darkGhost = `rgba(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b}, ${ghostAlpha * 0.7})`;
        
        gradient.addColorStop(0, lightGhost);
        gradient.addColorStop(0.6, `rgba(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b}, ${ghostAlpha})`);
        gradient.addColorStop(1, darkGhost);
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(pixelX, pixelY, size, size);
        
        // Restore context to remove clip
        ctx.restore();
        
        // Subtle border for definition
        ctx.strokeStyle = isLightMode ? 
            `rgba(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b}, 0.4)` : 
            `rgba(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b}, 0.3)`;
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, pixelX + 0.5, pixelY + 0.5, size - 1, size - 1, radius);
        ctx.stroke();
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
                    this.drawPreviewBlock(ctx, startX + x * blockSize, startY + y * blockSize, piece.color, blockSize);
                }
            }
        }
    }
    
    // Specialized function for drawing blocks in preview panels with 3D effect
    drawPreviewBlock(ctx, pixelX, pixelY, color, blockSize) {
        const isLightMode = document.body.classList.contains('light-mode');
        const radius = Math.max(2, blockSize * 0.15); // Scale radius with block size
        
        // Apply transparency in light mode
        if (isLightMode) {
            ctx.globalAlpha = 0.9; // 10% transparency in light mode
        }
        
        // Save context for clip path
        ctx.save();
        
        // Create rounded rectangle path
        this.drawRoundedRect(ctx, pixelX, pixelY, blockSize, blockSize, radius);
        ctx.clip();
        
        // Create radial gradient for 3D depth effect
        const gradient = ctx.createRadialGradient(
            pixelX + blockSize * 0.3, pixelY + blockSize * 0.3, 0,
            pixelX + blockSize * 0.5, pixelY + blockSize * 0.5, blockSize * 0.8
        );
        
        // Parse the hex color to create lighter and darker variants
        const rgb = this.hexToRgb(color);
        
        // In dark mode, reduce saturation and brightness to make pieces less vibrant
        let adjustedRgb = rgb;
        if (!isLightMode) {
            // Reduce saturation by blending with gray and reduce brightness in dark mode
            const desaturationFactor = 0.3; // Blend 30% with gray
            const brightnessFactor = 0.85; // Reduce brightness to 85%
            const gray = (rgb.r + rgb.g + rgb.b) / 3;
            
            adjustedRgb = {
                r: Math.round((rgb.r * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                g: Math.round((rgb.g * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor),
                b: Math.round((rgb.b * (1 - desaturationFactor) + gray * desaturationFactor) * brightnessFactor)
            };
        }
        
        const lightVariant = `rgb(${Math.min(255, adjustedRgb.r + 40)}, ${Math.min(255, adjustedRgb.g + 40)}, ${Math.min(255, adjustedRgb.b + 40)})`;
        const darkVariant = `rgb(${Math.max(0, adjustedRgb.r - 30)}, ${Math.max(0, adjustedRgb.g - 30)}, ${Math.max(0, adjustedRgb.b - 30)})`;
        const baseColor = `rgb(${adjustedRgb.r}, ${adjustedRgb.g}, ${adjustedRgb.b})`;
        
        gradient.addColorStop(0, lightVariant);
        gradient.addColorStop(0.6, baseColor);
        gradient.addColorStop(1, darkVariant);
        
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(pixelX, pixelY, blockSize, blockSize);
        
        // Add inner glow effect (scaled for preview)
        const innerGradient = ctx.createRadialGradient(
            pixelX + blockSize * 0.5, pixelY + blockSize * 0.5, 0,
            pixelX + blockSize * 0.5, pixelY + blockSize * 0.5, blockSize * 0.4
        );
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = innerGradient;
        ctx.fillRect(pixelX, pixelY, blockSize, blockSize);
        
        // Restore context to remove clip
        ctx.restore();
        
        // Simplified bevels for smaller preview blocks
        const bevelSize = Math.max(1, Math.floor(blockSize * 0.1));
        const highlightIntensity = isLightMode ? 0.6 : 0.3;
        const shadowIntensity = isLightMode ? 0.5 : 0.3;
        
        // Top and left highlights
        ctx.fillStyle = `rgba(255, 255, 255, ${highlightIntensity})`;
        ctx.fillRect(pixelX, pixelY, blockSize, bevelSize); // Top
        ctx.fillRect(pixelX, pixelY, bevelSize, blockSize); // Left
        
        // Bottom and right shadows
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowIntensity})`;
        ctx.fillRect(pixelX, pixelY + blockSize - bevelSize, blockSize, bevelSize); // Bottom
        ctx.fillRect(pixelX + blockSize - bevelSize, pixelY, bevelSize, blockSize); // Right
        
        // Subtle outer border
        ctx.strokeStyle = isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, pixelX + 0.5, pixelY + 0.5, blockSize - 1, blockSize - 1, radius);
        ctx.stroke();
        
        // Reset global alpha if it was changed
        if (isLightMode) {
            ctx.globalAlpha = 1.0;
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
    
    // Helper function to show level complete overlay
    showLevelCompleteOverlay(regionBonus) {
        const bonusText = regionBonus > 0 ? `Region Bonus: +${regionBonus.toLocaleString()}` : '';
        let message = `Starting Level ${this.level}<br><br>Score: ${this.score.toLocaleString()}<br>Completed Rows: +${this.levelRowPoints}`;
        if (bonusText) {
            message += `<br>${bonusText}`;
        }
        message += `<br><br>Press any key to continue`;
        this.showOverlay(`Level ${this.level - 1} Complete!`, message);
        
        // Pause the game while showing level complete message
        this.paused = true;
        
        // Set flag to wait for user input before continuing
        this.waitingForContinue = true;
    }
    
    // Enhanced region calculation that returns detailed region data
    calculateConnectedRegionBonusWithDetails() {
        const colorRegions = new Map();
        const visited = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(false));
        const regionDetails = [];
        
        // Find all connected regions using flood fill algorithm
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (!visited[y][x] && this.board[y][x] !== 0) {
                    const color = this.board[y][x];
                    const regionCells = [];
                    const regionSize = this.floodFillWithCells(x, y, color, visited, regionCells);
                    
                    // Track the largest region for each color
                    if (!colorRegions.has(color) || regionSize > colorRegions.get(color).size) {
                        colorRegions.set(color, {
                            size: regionSize,
                            cells: regionCells,
                            centerX: regionCells.reduce((sum, cell) => sum + cell.x, 0) / regionCells.length,
                            centerY: regionCells.reduce((sum, cell) => sum + cell.y, 0) / regionCells.length
                        });
                    }
                }
            }
        }
        
        // Calculate bonus and create region data
        const baseScore = 20;
        let totalBonus = 0;
        const regions = [];
        
        for (let [color, regionData] of colorRegions) {
            const bonus = regionData.size * baseScore * this.level;
            totalBonus += bonus;
            
            regions.push({
                color: color,
                size: regionData.size,
                cells: regionData.cells,
                centerX: regionData.centerX,
                centerY: regionData.centerY,
                bonus: bonus
            });
        }
        
        return { totalBonus, regions };
    }
    
    // Enhanced flood fill that also returns the cells
    floodFillWithCells(startX, startY, targetColor, visited, cells) {
        // Boundary checks
        if (startX < 0 || startX >= this.BOARD_WIDTH || 
            startY < 0 || startY >= this.BOARD_HEIGHT ||
            visited[startY][startX] || 
            this.board[startY][startX] !== targetColor) {
            return 0;
        }
        
        // Mark as visited and add to cells
        visited[startY][startX] = true;
        cells.push({ x: startX, y: startY });
        let regionSize = 1;
        
        // Recursively check all 4 directions
        const directions = [
            [0, -1], // up
            [0, 1],  // down
            [-1, 0], // left
            [1, 0]   // right
        ];
        
        for (let [dx, dy] of directions) {
            regionSize += this.floodFillWithCells(startX + dx, startY + dy, targetColor, visited, cells);
        }
        
        return regionSize;
    }
    
    // Start the region highlighting animation
    startRegionAnimation(regions, isFinalLevel = false) {
        this.levelAnimationActive = true;
        this.regionAnimations = [];
        this.scoreDisplays = [];
        this.isFinalLevelAnimation = isFinalLevel;
        
        // Color to frequency mapping for unique sounds
        const colorSounds = {
            '#1f77b4': 440,  // Blue - A4
            '#ff7f0e': 523,  // Orange - C5
            '#2ca02c': 587,  // Green - D5
            '#d62728': 659,  // Red - E5
            '#9467bd': 698,  // Purple - F5
            '#8c564b': 784   // Brown - G5
        };
        
        // Create animations for each region with staggered timing
        regions.forEach((region, index) => {
            // Calculate region bounds for sweep animation
            const minX = Math.min(...region.cells.map(c => c.x));
            const maxX = Math.max(...region.cells.map(c => c.x));
            const minY = Math.min(...region.cells.map(c => c.y));
            const maxY = Math.max(...region.cells.map(c => c.y));
            
            this.regionAnimations.push({
                region: region,
                startTime: index * 600, // 600ms delay between regions (reduced from 800ms)
                duration: 1500, // How long the highlight lasts
                sweepDuration: 600, // How long the sweep takes
                progress: 0,
                sweepProgress: 0,
                intensity: 0,
                completed: false,
                sweepCompleted: false,
                soundPlayed: false,
                bounds: { minX, maxX, minY, maxY },
                soundFrequency: colorSounds[region.color] || 440
            });
        });
        
        // Start the animation loop
        this.animationStartTime = Date.now();
    }
    
    // Update region animations
    updateRegionAnimations() {
        const now = Date.now();
        
        // Always update score displays with time-based animation, regardless of level animation state
        this.scoreDisplays = this.scoreDisplays.filter(display => {
            const age = now - display.createdTime;
            
            // Time-based fade out (independent of frame rate)
            // During level animations, make region scores fade faster for quicker transitions
            let fadeOutDuration;
            if (display.isRowScore) {
                fadeOutDuration = 2000; // 2s for row scores
            } else if (this.levelAnimationActive) {
                fadeOutDuration = 1000; // 1s for region scores during level animation
            } else {
                fadeOutDuration = 4000; // 4s for region scores normally
            }
            
            display.life = Math.max(0, 1 - (age / fadeOutDuration));
            
            return display.life > 0;
        });
        
        if (!this.levelAnimationActive) return;
        
        const currentTime = now - this.animationStartTime;
        let allCompleted = true;
        
        this.regionAnimations.forEach(animation => {
            if (!animation.completed) {
                const timeSinceStart = currentTime - animation.startTime;
                
                if (timeSinceStart >= 0) {
                    if (timeSinceStart <= animation.duration) {
                        // Animation is active
                        animation.progress = timeSinceStart / animation.duration;
                        
                        // Handle sweep animation (first part of the animation)
                        if (timeSinceStart <= animation.sweepDuration) {
                            animation.sweepProgress = timeSinceStart / animation.sweepDuration;
                            
                            // Play sound when sweep starts
                            if (!animation.soundPlayed) {
                                this.playSound(animation.soundFrequency, 0.4, 'triangle', 0.3);
                                animation.soundPlayed = true;
                            }
                        } else {
                            animation.sweepProgress = 1;
                            animation.sweepCompleted = true;
                        }
                        
                        // Intensity for the glow effect (peaks at 50% progress, then fades)
                        if (animation.progress <= 0.5) {
                            animation.intensity = animation.progress * 2; // 0 to 1
                        } else {
                            animation.intensity = 2 - (animation.progress * 2); // 1 to 0
                        }
                        
                        // Show score display when animation starts
                        if (timeSinceStart <= 100 && !animation.scoreShown) {
                            this.createScoreDisplay(animation.region);
                            animation.scoreShown = true;
                        }
                        
                        allCompleted = false;
                    } else {
                        // Animation completed
                        animation.completed = true;
                        animation.intensity = 0;
                        animation.sweepCompleted = true;
                    }
                } else {
                    allCompleted = false;
                }
            }
        });
        
        // Update score displays (moved to beginning of function, but keep this for level animations)
        // this.scoreDisplays = this.scoreDisplays.filter(display => {
        //     display.life -= 0.008; // Fade out slowly
        //     return display.life > 0;
        // });
        
        // If all animations are complete, show the level complete overlay or end game
        if (allCompleted && this.scoreDisplays.length === 0) {
            this.levelAnimationActive = false;
            const totalRegionBonus = this.regionAnimations.reduce((sum, anim) => sum + anim.region.bonus, 0);
            
            if (this.isFinalLevelAnimation) {
                // Final level completed - end the game
                this.endGame();
            } else {
                // Regular level completed - show overlay
                this.showLevelCompleteOverlay(totalRegionBonus);
            }
        }
    }
    
    // Create a score display for a region
    createScoreDisplay(region) {
        this.scoreDisplays.push({
            x: region.centerX * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
            y: region.centerY * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
            text: `+${region.bonus.toLocaleString()}`,
            color: region.color, // Store the region color for text rendering
            life: 1.0,
            scale: 0.1, // Start small and grow
            maxScale: 1.5,
            createdTime: Date.now() // Track creation time for time-based animation
        });
    }
    
    // Create a score display for completed rows
    createRowScoreDisplay(centerX, centerY, score) {
        this.scoreDisplays.push({
            x: centerX * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
            y: centerY * this.BLOCK_SIZE + this.BLOCK_SIZE / 2,
            text: `+${score.toLocaleString()}`,
            color: '#ffffff', // White color for row completion scores
            life: 1.0,
            scale: 0.1, // Start small and grow
            maxScale: 1.8, // Slightly larger than region scores
            isRowScore: true, // Flag to differentiate from region scores
            createdTime: Date.now() // Track creation time for time-based animation
        });
    }
    
    // Render region animations
    renderRegionAnimations() {
        // Always render score displays, regardless of level animation state
        this.scoreDisplays.forEach(display => {
            this.renderScoreDisplay(display);
        });
        
        if (!this.levelAnimationActive) return;
        
        // Render region highlights and sweeps
        this.regionAnimations.forEach(animation => {
            if (animation.intensity > 0 || animation.sweepProgress > 0) {
                this.renderRegionHighlight(animation.region, animation.intensity);
                
                // Render sweep effect if active
                if (animation.sweepProgress > 0 && !animation.sweepCompleted) {
                    this.renderRegionSweep(animation);
                }
            }
        });
    }
    
    // Render only region highlights and sweeps (without score displays)
    renderRegionHighlightsOnly() {
        if (!this.levelAnimationActive) return;
        
        // Render region highlights and sweeps
        this.regionAnimations.forEach(animation => {
            if (animation.intensity > 0 || animation.sweepProgress > 0) {
                this.renderRegionHighlight(animation.region, animation.intensity);
                
                // Render sweep effect if active
                if (animation.sweepProgress > 0 && !animation.sweepCompleted) {
                    this.renderRegionSweep(animation);
                }
            }
        });
    }
    
    // Render only score displays (to be called last for proper layering)
    renderScoreDisplaysOnly() {
        // Always render score displays on top of everything else
        this.scoreDisplays.forEach(display => {
            this.renderScoreDisplay(display);
        });
    }
    
    // Render a highlighted region
    renderRegionHighlight(region, intensity) {
        const isLightMode = document.body.classList.contains('light-mode');
        
        // Create glow effect for each cell in the region
        region.cells.forEach(cell => {
            const pixelX = cell.x * this.BLOCK_SIZE;
            const pixelY = cell.y * this.BLOCK_SIZE;
            
            // Outer glow
            const glowSize = 8;
            const gradient = this.ctx.createRadialGradient(
                pixelX + this.BLOCK_SIZE / 2, pixelY + this.BLOCK_SIZE / 2, 0,
                pixelX + this.BLOCK_SIZE / 2, pixelY + this.BLOCK_SIZE / 2, this.BLOCK_SIZE / 2 + glowSize
            );
            
            const glowColor = isLightMode ?
                `rgba(255, 255, 255, ${intensity * 0.6})` :
                `rgba(255, 255, 255, ${intensity * 0.4})`;
            
            gradient.addColorStop(0, glowColor);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(
                pixelX - glowSize, 
                pixelY - glowSize, 
                this.BLOCK_SIZE + glowSize * 2, 
                this.BLOCK_SIZE + glowSize * 2
            );
            
            // Inner bright highlight
            this.ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.3})`;
            this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        });
    }
    
    // Render a score display
    renderScoreDisplay(display) {
        const isLightMode = document.body.classList.contains('light-mode');
        const now = Date.now();
        const age = now - display.createdTime;
        
        // Time-based scale animation (independent of frame rate)
        const scaleGrowthDuration = 300; // 300ms to reach max scale
        const scaleShrinkStart = 1000; // Start shrinking after 1 second
        
        if (age < scaleGrowthDuration) {
            // Growing phase
            display.scale = 0.1 + (display.maxScale - 0.1) * (age / scaleGrowthDuration);
        } else if (age > scaleShrinkStart) {
            // Shrinking phase
            const shrinkProgress = Math.min(1, (age - scaleShrinkStart) / 1000); // 1 second shrink duration
            display.scale = Math.max(0.8, display.maxScale - (display.maxScale - 0.8) * shrinkProgress);
        } else {
            // Hold at max scale
            display.scale = display.maxScale;
        }
        
        this.ctx.save();
        this.ctx.font = `bold ${Math.floor(24 * display.scale)}px 'Segoe UI', sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Enhanced black drop shadow with multiple layers for maximum contrast
        const shadowOffset = 4;
        const shadowBlur = 6;
        const textAlpha = display.life;
        
        // Strong black outer shadow for maximum contrast - with fade
        this.ctx.shadowColor = `rgba(0, 0, 0, ${0.95 * textAlpha})`;
        this.ctx.shadowOffsetX = shadowOffset + 2;
        this.ctx.shadowOffsetY = shadowOffset + 2;
        this.ctx.shadowBlur = shadowBlur + 3;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * textAlpha})`;
        this.ctx.fillText(display.text, display.x, display.y);
        
        // Additional closer black shadow for depth - with fade
        this.ctx.shadowColor = `rgba(0, 0, 0, ${0.8 * textAlpha})`;
        this.ctx.shadowOffsetX = shadowOffset;
        this.ctx.shadowOffsetY = shadowOffset;
        this.ctx.shadowBlur = shadowBlur;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * textAlpha})`;
        this.ctx.fillText(display.text, display.x, display.y);
        
        // Reset shadow for main text
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        this.ctx.shadowBlur = 0;
        
        // Main text color - white for all score displays for clean, consistent look
        // Apply the fade through the color alpha instead of globalAlpha
        this.ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
        
        this.ctx.fillText(display.text, display.x, display.y);
        
        this.ctx.restore();
    }

    // Helper function to draw rounded rectangles
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    // Helper function to convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }
    
    // Helper function to draw beveled edges for 3D effect
    drawBevelEdge(ctx, x, y, size, bevelSize, edge, color, radius) {
        ctx.fillStyle = color;
        ctx.save();
        
        // Create clipping path for the bevel based on edge
        ctx.beginPath();
        
        switch (edge) {
            case 'top':
                // Top bevel - trapezoid shape
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + size - radius, y);
                ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
                ctx.lineTo(x + size - bevelSize, y + bevelSize);
                ctx.lineTo(x + bevelSize, y + bevelSize);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                break;
                
            case 'left':
                // Left bevel
                ctx.moveTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.lineTo(x + bevelSize, y + bevelSize);
                ctx.lineTo(x + bevelSize, y + size - bevelSize);
                ctx.lineTo(x, y + size - radius);
                ctx.quadraticCurveTo(x, y + size, x + radius, y + size);
                ctx.lineTo(x, y + size - radius);
                break;
                
            case 'bottom':
                ctx.moveTo(x + radius, y + size);
                ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
                ctx.lineTo(x + bevelSize, y + size - bevelSize);
                ctx.lineTo(x + size - bevelSize, y + size - bevelSize);
                ctx.lineTo(x + size, y + size - radius);
                ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
                break;
                
            case 'right':
                // Right bevel
                ctx.moveTo(x + size, y + radius);
                ctx.lineTo(x + size - bevelSize, y + bevelSize);
                ctx.lineTo(x + size - bevelSize, y + size - bevelSize);
                ctx.lineTo(x + size, y + size - radius);
                ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
                ctx.lineTo(x + size - radius, y + size);
                ctx.quadraticCurveTo(x + size, y + size, x + size, y + size - radius);
                break;
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    
    // Render sweep effect for a region
    renderRegionSweep(animation) {
        const isLightMode = document.body.classList.contains('light-mode');
        const region = animation.region;
        const bounds = animation.bounds;
        
        // Calculate sweep position based on region bounds
        const regionWidth = (bounds.maxX - bounds.minX + 1) * this.BLOCK_SIZE;
        const regionHeight = (bounds.maxY - bounds.minY + 1) * this.BLOCK_SIZE;
        const startX = bounds.minX * this.BLOCK_SIZE;
        const startY = bounds.minY * this.BLOCK_SIZE;
        
        // Sweep moves from left to right across the region
        const sweepX = startX + (animation.sweepProgress * regionWidth);
        const sweepWidth = 40; // Width of the sweep effect
        
        // Create a clipping path for the region shape
        this.ctx.save();
        this.ctx.beginPath();
        
        // Create complex path from region cells
        const cellSize = this.BLOCK_SIZE;
        region.cells.forEach(cell => {
            const cellX = cell.x * cellSize;
            const cellY = cell.y * cellSize;
            this.ctx.rect(cellX, cellY, cellSize, cellSize);
        });
        
        this.ctx.clip();
        
        // Create gradient for the sweep effect
        const gradient = this.ctx.createLinearGradient(
            sweepX - sweepWidth, 0,
            sweepX + sweepWidth, 0
        );
        
        // Parse region color for sweep effect
        const rgb = this.hexToRgb(region.color);
        const sweepIntensity = 0.8;
        
        // Create sweep gradient with region color
        const centerColor = isLightMode ?
            `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${sweepIntensity})` :
            `rgba(${Math.min(255, rgb.r + 100)}, ${Math.min(255, rgb.g + 100)}, ${Math.min(255, rgb.b + 100)}, ${sweepIntensity})`;
        const edgeColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`;
        
        gradient.addColorStop(0, edgeColor);
        gradient.addColorStop(0.5, centerColor);
        gradient.addColorStop(1, edgeColor);
        
        // Draw the sweep
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
            sweepX - sweepWidth,
            startY,
            sweepWidth * 2,
            regionHeight
        );
        
        this.ctx.restore();
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
