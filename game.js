// Get DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const gameOverMessage = document.getElementById('game-over-message');
const restartButton = document.getElementById('restart-button');
const gameContainer = document.getElementById('game-container');
// Share Elements
const shareTwitterBtn = document.getElementById('share-twitter');
const shareFacebookBtn = document.getElementById('share-facebook');
const copyLinkBtn = document.getElementById('copy-link');
const copyFeedbackEl = document.getElementById('copy-feedback');


// --- Load Game Assets ---
const playerImg = new Image(); playerImg.src = 'vezenkov.png';
const obstacleTopImg = new Image(); obstacleTopImg.src = 'obstacle_top.png';
const obstacleBottomImg = new Image(); obstacleBottomImg.src = 'obstacle_bottom.png';
const backgroundImg = new Image();
backgroundImg.src = 'basketball-court-full.jpg'; // Ensure this matches your wide image filename

let assetsLoaded = 0;
let totalAssets = 4;

function assetLoaded(assetName, success) {
    assetsLoaded++;
    console.log(`Asset "${assetName}" ${success ? 'loaded' : 'FAILED'}. (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded >= totalAssets) {
        console.log("All essential assets processed, attempting init.");
        attemptInit();
    }
}

playerImg.onload = () => assetLoaded('player', true);
obstacleTopImg.onload = () => assetLoaded('obstacleTop', true);
obstacleBottomImg.onload = () => assetLoaded('obstacleBottom', true);
backgroundImg.onload = () => assetLoaded('background', true);

playerImg.onerror = () => assetLoaded('player', false);
obstacleTopImg.onerror = () => assetLoaded('obstacleTop', false);
obstacleBottomImg.onerror = () => assetLoaded('obstacleBottom', false);
backgroundImg.onerror = () => assetLoaded('background', false);
// --- End Asset Loading ---

// --- Share Configuration ---
const GAME_URL = window.location.href;
const BASE_SHARE_TEXT = "I drew {score} fouls in Flappy Flopper! Can you beat my score?";
const TWITTER_HASHTAGS = "FlappyFlopper,Vezenkov,paobc,olympiacosbc";
// --- End Share Configuration ---

// Game variables
let player;
let obstacles;
let score;
let gravity;
let lift;
let gameSpeed;
let gameState;
let frameCount;
let sourceBackgroundX = 0; // << RENAMED: Tracks the X coord in the SOURCE image
const BACKGROUND_PAN_SPEED_FACTOR = 0.8; // << ADJUSTED: Panning speed factor (might need tuning)
let backgroundDirection = 1; // << CHANGED: Start moving right initially

// Player settings
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 60;

// Obstacle settings
const OBSTACLE_WIDTH = 157;
const GAP_HEIGHT = 160;
const OBSTACLE_IMG_HEIGHT = 350;

// --- Hitbox Difficulty Transition ---
const MAX_SCORE_FOR_DIFFICULTY = 30;

// --- Single Dynamic Hitbox Definitions ---
const TOP_HAND_OFFSET_Y_EASY = 325; const TOP_HAND_HEIGHT_EASY = 20; const TOP_HAND_OFFSET_X_EASY = 45; const TOP_HAND_WIDTH_EASY = 65;
const TOP_HAND_OFFSET_Y_HARD = 270; const TOP_HAND_HEIGHT_HARD = 70; const TOP_HAND_OFFSET_X_HARD = 25; const TOP_HAND_WIDTH_HARD = 105;
const BOTTOM_HAND_OFFSET_Y_EASY = 5; const BOTTOM_HAND_HEIGHT_EASY = 20; const BOTTOM_HAND_OFFSET_X_EASY = 40; const BOTTOM_HAND_WIDTH_EASY = 75;
const BOTTOM_HAND_OFFSET_Y_HARD = 15; const BOTTOM_HAND_HEIGHT_HARD = 65; const BOTTOM_HAND_OFFSET_X_HARD = 28; const BOTTOM_HAND_WIDTH_HARD = 100;
// --- End Hitbox Definitions ---

const MIN_GAP_Y = 60;
const MAX_GAP_Y = canvas.height - GAP_HEIGHT - 60;
const OBSTACLE_SPAWN_RATE = 150;
const DRAW_HITBOXES = true;

// Linear interpolation function
function lerp(start, end, t) {
    t = Math.max(0, Math.min(1, t));
    return start + (end - start) * t;
}

// --- Core Functions ---

function initGame() {
    console.log("Initializing game...");
    player = { x: 50, y: canvas.height / 2 - PLAYER_HEIGHT / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, velocityY: 0, scale: 1 };
    obstacles = []; score = 0; gravity = 0.25; lift = -6; gameSpeed = 1.8; gameState = 'start'; frameCount = 0;
    sourceBackgroundX = 0; // Reset source background position
    backgroundDirection = 1; // Start moving right
    scoreDisplay.textContent = `Fouls Drawn: 0`; scoreDisplay.classList.remove('pop');
    gameOverScreen.classList.remove('visible'); startScreen.classList.add('visible');
    scoreDisplay.style.display = 'none';
    copyFeedbackEl.classList.remove('visible');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(); // Draw initial background frame
}

function startGame() {
    if (gameState === 'start') {
        console.log("Starting game...");
        gameState = 'playing';
        startScreen.classList.remove('visible');
        scoreDisplay.style.display = 'block';
        player.velocityY = lift;
        playerFlop();
        gameLoop();
    }
}

function endGame() {
    if (gameState !== 'gameOver') {
        console.log("Game Over. Score:", score);
        gameState = 'gameOver';
        gameOverScreen.classList.add('visible');
        finalScoreDisplay.textContent = score;
        const messages = ["Technical Foul!", "Yellow Card for Diving!", "And the Oscar goes to...", "He felt that one!", "Called for Traveling (sideways)!", "Flopped too hard!", "Ref didn't buy it!"];
        gameOverMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
        gameContainer.classList.add('shake');
        setTimeout(() => { gameContainer.classList.remove('shake'); }, 150);
        updateShareData(score);
    }
}

function playerFlop() {
    if (gameState === 'playing') {
        player.velocityY = lift;
        player.scale = 1.15;
    }
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}

function update() {
    if (gameState !== 'playing') return;

    // --- Background Panning (Bounce) Logic --- << UPDATED SECTION
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) {
        // Calculate scaling factor to fit height
        const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; // e.g., 480 / 960 = 0.5
        // Calculate the width of the source rectangle needed to fill the canvas width when scaled
        const sourceDrawWidth = canvas.width / bgScaleFactor; // e.g., 320 / 0.5 = 640

        // Only pan if the source image is wider than the required source draw width
        if (backgroundImg.naturalWidth > sourceDrawWidth) {
            let panAmount = gameSpeed * BACKGROUND_PAN_SPEED_FACTOR * backgroundDirection;
            sourceBackgroundX += panAmount;

            // Calculate boundaries for the source X coordinate
            const maxSourceX = backgroundImg.naturalWidth - sourceDrawWidth; // Furthest right the source rect can start

            // Check boundaries and reverse direction
            if (sourceBackgroundX >= maxSourceX) {
                sourceBackgroundX = maxSourceX; // Clamp
                backgroundDirection = -1; // Move left
                // console.log("Hit right boundary, moving left. MaxX:", maxSourceX);
            } else if (sourceBackgroundX <= 0) {
                sourceBackgroundX = 0; // Clamp
                backgroundDirection = 1; // Move right
                // console.log("Hit left boundary, moving right.");
            }
        } else {
             // If image isn't wider than needed, center it horizontally (optional)
             sourceBackgroundX = (backgroundImg.naturalWidth - sourceDrawWidth) / 2;
        }
    }
    // --- End Background Panning Logic ---

    // --- Player Physics ---
    player.velocityY += gravity; player.y += player.velocityY;
    if (player.y < 0) { player.y = 0; player.velocityY = 0; }
    if (player.y + player.height > canvas.height) { player.y = canvas.height - player.height; endGame(); return; }
    if (player.scale > 1) { player.scale -= 0.05; if (player.scale < 1) player.scale = 1; } else { player.scale = 1; }

    // --- Obstacle Logic ---
    const difficultyProgress = Math.min(1, score / MAX_SCORE_FOR_DIFFICULTY);
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= gameSpeed;
        const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
        const bobAmount = 3; obs.bobbingOffset += 0.05; const currentBob = Math.sin(obs.bobbingOffset) * bobAmount;
        obs.currentTopImageY = obs.baseTopY + currentBob; obs.currentBottomImageY = obs.baseBottomY + currentBob;

        const topHitboxX = obs.x + lerp(TOP_HAND_OFFSET_X_EASY, TOP_HAND_OFFSET_X_HARD, difficultyProgress);
        const topHitboxY = obs.currentTopImageY + lerp(TOP_HAND_OFFSET_Y_EASY, TOP_HAND_OFFSET_Y_HARD, difficultyProgress);
        const topHitboxW = lerp(TOP_HAND_WIDTH_EASY, TOP_HAND_WIDTH_HARD, difficultyProgress);
        const topHitboxH = lerp(TOP_HAND_HEIGHT_EASY, TOP_HAND_HEIGHT_HARD, difficultyProgress);
        const bottomHitboxX = obs.x + lerp(BOTTOM_HAND_OFFSET_X_EASY, BOTTOM_HAND_OFFSET_X_HARD, difficultyProgress);
        const bottomHitboxY = obs.currentBottomImageY + lerp(BOTTOM_HAND_OFFSET_Y_EASY, BOTTOM_HAND_OFFSET_Y_HARD, difficultyProgress);
        const bottomHitboxW = lerp(BOTTOM_HAND_WIDTH_EASY, BOTTOM_HAND_WIDTH_HARD, difficultyProgress);
        const bottomHitboxH = lerp(BOTTOM_HAND_HEIGHT_EASY, BOTTOM_HAND_HEIGHT_HARD, difficultyProgress);

        obs.hitboxRects = [ { x: topHitboxX, y: topHitboxY, width: topHitboxW, height: topHitboxH }, { x: bottomHitboxX, y: bottomHitboxY, width: bottomHitboxW, height: bottomHitboxH } ];

        if (isColliding(playerRect, obs.hitboxRects[0]) || isColliding(playerRect, obs.hitboxRects[1])) { endGame(); return; }
        if (!obs.passed && obs.x + obs.width < player.x) { obs.passed = true; score++; scoreDisplay.textContent = `Fouls Drawn: ${score}`; scoreDisplay.classList.add('pop'); setTimeout(() => { scoreDisplay.classList.remove('pop'); }, 150); if (score > 0 && score % 8 === 0) { gameSpeed += 0.05; console.log("Speed increased to:", gameSpeed.toFixed(2)); } }
        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); }
    }

    // --- Spawn New Obstacles ---
    if (frameCount % OBSTACLE_SPAWN_RATE === 0) {
        const topGapY = Math.random() * (MAX_GAP_Y - MIN_GAP_Y) + MIN_GAP_Y; const bottomGapY = topGapY + GAP_HEIGHT;
        const topImageActualHeight = obstacleTopImg.naturalHeight || OBSTACLE_IMG_HEIGHT; const bottomImageActualHeight = obstacleBottomImg.naturalHeight || OBSTACLE_IMG_HEIGHT;
        const topImageY = topGapY - topImageActualHeight; const bottomImageY = bottomGapY;
        obstacles.push({ x: canvas.width, width: OBSTACLE_WIDTH, baseTopY: topImageY, topImageHeight: topImageActualHeight, baseBottomY: bottomImageY, bottomImageHeight: bottomImageActualHeight, bobbingOffset: Math.random() * Math.PI * 2, currentTopImageY: topImageY, currentBottomImageY: bottomImageY, passed: false, hitboxRects: [{}, {}] });
    }
}

// --- Drawing Functions ---

function drawBackground() { // << UPDATED SIGNIFICANTLY
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) {
        // Calculate scaling factor to fit height exactly
        const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; // e.g., 480 / 960 = 0.5

        // Calculate the width of the source rectangle needed to fill the canvas width when scaled
        const sourceDrawWidth = canvas.width / bgScaleFactor; // e.g., 320 / 0.5 = 640

        // Clamp sourceBackgroundX to ensure it's within valid bounds
        let clampedSourceX = Math.max(0, sourceBackgroundX); // Don't go below 0
        if (backgroundImg.naturalWidth > sourceDrawWidth) { // Only apply max clamp if image is wider than needed
             clampedSourceX = Math.min(clampedSourceX, backgroundImg.naturalWidth - sourceDrawWidth);
        } else {
            clampedSourceX = (backgroundImg.naturalWidth - sourceDrawWidth) / 2; // Center if not wide enough
            clampedSourceX = Math.max(0, clampedSourceX); // Ensure centering doesn't go negative
        }


        // Draw the correctly scaled portion of the background image
        ctx.drawImage(
            backgroundImg,        // Source image
            clampedSourceX, 0,    // Source x (panning position), Source y (top)
            sourceDrawWidth,      // Source width (calculated to maintain aspect ratio)
            backgroundImg.naturalHeight, // Source height (full image height)
            0, 0,                 // Destination x, y (top-left of canvas)
            canvas.width,         // Destination width (full canvas width)
            canvas.height         // Destination height (full canvas height)
        );

        // Apply Dimming Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Adjust opacity 0.0 (none) to 1.0 (opaque)
        ctx.fillRect(0, 0, canvas.width, canvas.height);

    } else {
        // Fallback gradient if image fails to load
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#282c34");
        gradient.addColorStop(1, "#1f232a");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}


function drawPlayer() {
    if (playerImg.complete && playerImg.naturalWidth !== 0) {
        const scaledWidth = player.width * player.scale; const scaledHeight = player.height * player.scale;
        ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        let angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, player.velocityY * 0.08)); ctx.rotate(angle);
        ctx.drawImage(playerImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight); ctx.restore();
    } else { ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, player.width, player.height); }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        if (obstacleTopImg.complete && obstacleTopImg.naturalWidth > 0) { ctx.drawImage(obstacleTopImg, obstacle.x, obstacle.currentTopImageY, obstacle.width, obstacle.topImageHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentTopImageY, obstacle.width, obstacle.topImageHeight); }
        if (obstacleBottomImg.complete && obstacleBottomImg.naturalWidth > 0) { ctx.drawImage(obstacleBottomImg, obstacle.x, obstacle.currentBottomImageY, obstacle.width, obstacle.bottomImageHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentBottomImageY, obstacle.width, obstacle.bottomImageHeight); }
        if (DRAW_HITBOXES && obstacle.hitboxRects && obstacle.hitboxRects.length === 2) { ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; ctx.fillRect(obstacle.hitboxRects[0].x, obstacle.hitboxRects[0].y, obstacle.hitboxRects[0].width, obstacle.hitboxRects[0].height); ctx.fillRect(obstacle.hitboxRects[1].x, obstacle.hitboxRects[1].y, obstacle.hitboxRects[1].width, obstacle.hitboxRects[1].height); }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(); // Draw background first
    drawObstacles();
    if (player) {
        drawPlayer();
    }
}

function gameLoop() {
    if (gameState === 'gameOver') return;
    update(); draw(); frameCount++;
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners --- (No changes needed below this line)
function handleInput(event) { event.preventDefault(); if (gameState === 'start') startGame(); else if (gameState === 'playing') playerFlop(); }
gameContainer.addEventListener('mousedown', handleInput); gameContainer.addEventListener('touchstart', handleInput);
document.addEventListener('keydown', function(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleInput(e); } });
function handleRestart(event) { event.preventDefault(); event.stopPropagation(); console.log("Restart button clicked"); initGame(); }
restartButton.addEventListener('click', handleRestart); restartButton.addEventListener('touchstart', handleRestart);

// --- Share Functionality ---
function updateShareData(currentScore) { const text = BASE_SHARE_TEXT.replace('{score}', currentScore); const encodedText = encodeURIComponent(text); const encodedUrl = encodeURIComponent(GAME_URL); shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${TWITTER_HASHTAGS}`; shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}"e=${encodedText}`; }
function copyShareLink(event) { event.preventDefault(); event.stopPropagation(); const textToCopy = BASE_SHARE_TEXT.replace('{score}', score) + ` Play here: ${GAME_URL}`; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(() => { copyFeedbackEl.textContent = 'Copied!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); }).catch(err => { console.error('Failed to copy text using Clipboard API: ', err); copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); }); } else { try { const textArea = document.createElement("textarea"); textArea.value = textToCopy; textArea.style.position = "fixed"; textArea.style.opacity = "0"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); copyFeedbackEl.textContent = 'Copied! (fallback)'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } catch (err) { console.error('Fallback copy method failed: ', err); copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } } }
shareTwitterBtn.addEventListener('click', (e) => { updateShareData(score); }); shareFacebookBtn.addEventListener('click', (e) => { updateShareData(score); }); copyLinkBtn.addEventListener('click', copyShareLink); copyLinkBtn.addEventListener('touchstart', copyShareLink);

// --- Initial Setup ---
function attemptInit() { if (assetsLoaded >= totalAssets && (typeof gameState === 'undefined' || gameState === 'loading')) { console.log("Assets ready, setting game state to 'initializing'"); gameState = 'initializing'; initGame(); } else if (typeof gameState === 'undefined') { console.log("Assets not ready yet, setting state to 'loading'"); gameState = 'loading'; } }
setTimeout(() => { if (typeof gameState === 'undefined' || gameState === 'loading') { console.warn("Asset load timeout (3s). Forcing initialization attempt."); attemptInit(); } }, 3000);
attemptInit();