// --- Get DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score');
const gameOverMessage = document.getElementById('game-over-message');
const restartButton = document.getElementById('restart-button');
const gameContainer = document.getElementById('game-container');
const pageWrapper = document.querySelector('.page-wrapper'); // For shake effect
// Share Elements
const shareTwitterBtn = document.getElementById('share-twitter');
const shareFacebookBtn = document.getElementById('share-facebook');
const copyLinkBtn = document.getElementById('copy-link');
const copyFeedbackEl = document.getElementById('copy-feedback');
// Hitbox Toggle Checkbox
const hitboxToggleCheckbox = document.getElementById('hitboxToggle');


// --- Load Game Assets ---
const playerImg = new Image(); playerImg.src = 'vezenkov.png';
const obstacleTopImg = new Image(); obstacleTopImg.src = 'obstacle_top.png'; // Should be 114x350
const obstacleBottomImg = new Image(); obstacleBottomImg.src = 'obstacle_bottom.png'; // Should be 114x350
const backgroundImg = new Image();
backgroundImg.src = 'basketball-court-full.jpg'; // Wide background image

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
const GAME_URL = window.location.href; // Or your specific game URL
const BASE_SHARE_TEXT = "I drew {score} fouls in Flappy Flopper! Can you beat my score?";
const TWITTER_HASHTAGS = "FlappyFlopper,Vezenkov,paobc,olympiacosbc"; // Comma-separated
// --- End Share Configuration ---

// Game variables
let player;
let obstacles;
let score;
let gravity;
let lift;
let gameSpeed;
let gameState; // 'loading', 'initializing', 'start', 'playing', 'gameOver'
let frameCount;
let sourceBackgroundX = 0;
const BACKGROUND_PAN_SPEED_FACTOR = 0.8;
let backgroundDirection = 1;
let showHitboxes = false; // Start with hitboxes OFF

// Player settings
const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 60;

// --- Difficulty Transition ---
const MAX_SCORE_FOR_DIFFICULTY = 45; // Score for max difficulty (gap & spacing)

// --- Obstacle settings ---
const OBSTACLE_WIDTH = 114;      // Updated width
const OBSTACLE_IMG_HEIGHT = 350; // Image height (used as fallback)

// --- Dynamic Gap Size ---
const INITIAL_GAP_HEIGHT = 190;
const FINAL_GAP_HEIGHT = 140;
const MIN_OBSTACLE_Y_MARGIN = 50;
const MAX_GAP_TOP_Y = canvas.height - FINAL_GAP_HEIGHT - MIN_OBSTACLE_Y_MARGIN;

// --- Dynamic Obstacle Spacing (Horizontal) ---
const INITIAL_SPAWN_RATE = 180; // Frames between spawns initially
const FINAL_SPAWN_RATE = 110;   // Frames between spawns finally

// Linear interpolation function
function lerp(start, end, t) {
    t = Math.max(0, Math.min(1, t));
    if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
        console.error("Invalid input to lerp:", start, end, t);
        return start;
    }
    return start + (end - start) * t;
}

// --- Core Functions ---

function initGame() {
    console.log("Initializing game...");
    player = { x: 50, y: canvas.height / 2 - PLAYER_HEIGHT / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, velocityY: 0, scale: 1 };
    obstacles = []; score = 0; gravity = 0.25; lift = -6; gameSpeed = 1.8; gameState = 'start'; frameCount = 0;
    sourceBackgroundX = 0; backgroundDirection = 1;

    // Reset UI
    scoreDisplay.textContent = `Fouls Drawn: 0`; scoreDisplay.classList.remove('pop');
    gameOverScreen.classList.remove('visible'); startScreen.classList.add('visible');
    scoreDisplay.style.display = 'none'; copyFeedbackEl.classList.remove('visible');
    pageWrapper.classList.remove('shake'); // Ensure shake is removed on restart

    // Set initial state of the toggle switch based on the variable
    hitboxToggleCheckbox.checked = showHitboxes;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(); // Draw initial background
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

        // Add shake effect to the page wrapper for broader effect
        pageWrapper.classList.add('shake');
        setTimeout(() => { pageWrapper.classList.remove('shake'); }, 150);

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
    // Added check for rect1 as well for safety
    if (!rect1 || !rect2 || !rect1.width || !rect1.height || !rect2.width || !rect2.height) return false;
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}


function update() {
    if (gameState !== 'playing') return;

    // --- Background Panning ---
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) {
        const bgScaleFactor = canvas.height / backgroundImg.naturalHeight;
        const sourceDrawWidth = canvas.width / bgScaleFactor;
        if (backgroundImg.naturalWidth > sourceDrawWidth) {
            let panAmount = gameSpeed * BACKGROUND_PAN_SPEED_FACTOR * backgroundDirection;
            sourceBackgroundX += panAmount;
            const maxSourceX = backgroundImg.naturalWidth - sourceDrawWidth;
            if (sourceBackgroundX >= maxSourceX) { sourceBackgroundX = maxSourceX; backgroundDirection = -1; }
            else if (sourceBackgroundX <= 0) { sourceBackgroundX = 0; backgroundDirection = 1; }
        } else { sourceBackgroundX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); }
    }

    // --- Player Physics ---
    player.velocityY += gravity; player.y += player.velocityY;
    if (player.y < 0) { player.y = 0; player.velocityY = 0; }
    if (player.y + player.height > canvas.height) { player.y = canvas.height - player.height; endGame(); return; }
    if (player.scale > 1) { player.scale -= 0.05; if (player.scale < 1) player.scale = 1; }
    else { player.scale = 1; }

    // --- Difficulty Progress ---
    const difficultyProgress = Math.min(1, score / MAX_SCORE_FOR_DIFFICULTY);

    // --- Dynamic Spawn Rate ---
    const currentSpawnRate = Math.round(lerp(INITIAL_SPAWN_RATE, FINAL_SPAWN_RATE, difficultyProgress));

    // --- Obstacle Logic ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= gameSpeed;

        const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };

        // --- Hitboxes (Full Image) ---
        // Ensure current positions are initialized before calculating hitboxes
        if (typeof obs.currentTopImageY === 'undefined') obs.currentTopImageY = obs.baseTopY;
        if (typeof obs.currentBottomImageY === 'undefined') obs.currentBottomImageY = obs.baseBottomY;

        // Calculate actual height to use for hitbox (prioritize loaded image dimensions)
        const currentTopHeight = obstacleTopImg.naturalHeight || obs.topImageHeight || OBSTACLE_IMG_HEIGHT;
        const currentBottomHeight = obstacleBottomImg.naturalHeight || obs.bottomImageHeight || OBSTACLE_IMG_HEIGHT;

        // Define hitbox rectangles based on current position, width, and calculated height
        obs.hitboxRects = [
            { x: obs.x, y: obs.currentTopImageY, width: obs.width, height: currentTopHeight },
            { x: obs.x, y: obs.currentBottomImageY, width: obs.width, height: currentBottomHeight }
        ];

        // --- Collision ---
        if (isColliding(playerRect, obs.hitboxRects[0]) || isColliding(playerRect, obs.hitboxRects[1])) {
            endGame(); return;
        }

        // --- Scoring & Speed ---
        if (!obs.passed && obs.x + obs.width < player.x) {
             obs.passed = true; score++; scoreDisplay.textContent = `Fouls Drawn: ${score}`;
             scoreDisplay.classList.add('pop'); setTimeout(() => { scoreDisplay.classList.remove('pop'); }, 150);
             // Optional speed increase independent of main difficulty lerp
             if (score > 0 && score % 8 === 0) { gameSpeed += 0.05; console.log("Speed increased to:", gameSpeed.toFixed(2)); }
        }

        // --- Removal ---
        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); }
    }

    // --- Spawn New Obstacles ---
    if (frameCount % currentSpawnRate === 0) {
        const currentGapHeight = lerp(INITIAL_GAP_HEIGHT, FINAL_GAP_HEIGHT, difficultyProgress);
        const topGapY = Math.random() * (MAX_GAP_TOP_Y - MIN_OBSTACLE_Y_MARGIN) + MIN_OBSTACLE_Y_MARGIN;
        const bottomGapY = topGapY + currentGapHeight;
        const topImageActualHeight = obstacleTopImg.naturalHeight || OBSTACLE_IMG_HEIGHT;
        const bottomImageActualHeight = obstacleBottomImg.naturalHeight || OBSTACLE_IMG_HEIGHT;
        const topImageY = topGapY - topImageActualHeight;
        const bottomImageY = bottomGapY;

        obstacles.push({
            x: canvas.width, width: OBSTACLE_WIDTH,
            baseTopY: topImageY, topImageHeight: topImageActualHeight,
            baseBottomY: bottomImageY, bottomImageHeight: bottomImageActualHeight,
            // Initialize current positions right away
            currentTopImageY: topImageY, currentBottomImageY: bottomImageY,
            passed: false, hitboxRects: [{}, {}] // Hitboxes calculated in update
        });
    }
    frameCount++;
}

// --- Drawing Functions ---

function drawBackground() {
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) {
        const bgScaleFactor = canvas.height / backgroundImg.naturalHeight;
        const sourceDrawWidth = canvas.width / bgScaleFactor;
        let clampedSourceX = Math.max(0, sourceBackgroundX);
        if (backgroundImg.naturalWidth > sourceDrawWidth) { clampedSourceX = Math.min(clampedSourceX, backgroundImg.naturalWidth - sourceDrawWidth); }
        else { clampedSourceX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); }
        ctx.drawImage(backgroundImg, clampedSourceX, 0, sourceDrawWidth, backgroundImg.naturalHeight, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Fallback gradient if image fails
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#282c34"); gradient.addColorStop(1, "#1f232a");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawPlayer() {
    if (!player) return;
    if (playerImg.complete && playerImg.naturalWidth !== 0) {
        const scaledWidth = player.width * player.scale; const scaledHeight = player.height * player.scale;
        ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        let angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, player.velocityY * 0.08)); ctx.rotate(angle);
        ctx.drawImage(playerImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight); ctx.restore();
    } else { ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, player.width, player.height); }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        const currentTopHeight = obstacleTopImg.naturalHeight || obstacle.topImageHeight || OBSTACLE_IMG_HEIGHT;
        const currentBottomHeight = obstacleBottomImg.naturalHeight || obstacle.bottomImageHeight || OBSTACLE_IMG_HEIGHT;

        // Draw Images
        if (obstacleTopImg.complete && obstacleTopImg.naturalWidth > 0) { ctx.drawImage(obstacleTopImg, obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); }
        else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); }
        if (obstacleBottomImg.complete && obstacleBottomImg.naturalWidth > 0) { ctx.drawImage(obstacleBottomImg, obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); }
        else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); }

        // Draw Hitboxes if toggled ON
        if (showHitboxes && obstacle.hitboxRects && obstacle.hitboxRects.length === 2) {
             ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; // Semi-transparent red
             // Check if hitbox data exists before drawing
             if (obstacle.hitboxRects[0] && obstacle.hitboxRects[0].width) {
                 ctx.fillRect(obstacle.hitboxRects[0].x, obstacle.hitboxRects[0].y, obstacle.hitboxRects[0].width, obstacle.hitboxRects[0].height);
             }
             if (obstacle.hitboxRects[1] && obstacle.hitboxRects[1].width) {
                 ctx.fillRect(obstacle.hitboxRects[1].x, obstacle.hitboxRects[1].y, obstacle.hitboxRects[1].width, obstacle.hitboxRects[1].height);
             }
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(); drawObstacles(); if (player) { drawPlayer(); }
}

function gameLoop() {
    // Stop the loop if the game state is no longer 'playing'
    if (gameState !== 'playing') return;
    update(); draw(); requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
function handleInput(event) {
    event.preventDefault();
    if (gameState === 'start') { startGame(); } else if (gameState === 'playing') { playerFlop(); }
}
gameContainer.addEventListener('mousedown', handleInput); gameContainer.addEventListener('touchstart', handleInput);
document.addEventListener('keydown', function(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleInput(e); } });
function handleRestart(event) { event.preventDefault(); event.stopPropagation(); console.log("Restart button clicked"); initGame(); }
restartButton.addEventListener('click', handleRestart); restartButton.addEventListener('touchstart', handleRestart);

// --- Hitbox Toggle Listener ---
function handleHitboxToggleChange(event) {
    showHitboxes = event.target.checked; // Update state based on checkbox
    console.log("Show Hitboxes:", showHitboxes);
    // No need to update text content; CSS handles the visual state of the switch
}
hitboxToggleCheckbox.addEventListener('change', handleHitboxToggleChange);

// --- Share Functionality ---
function updateShareData(currentScore) {
    const text = BASE_SHARE_TEXT.replace('{score}', currentScore); const encodedText = encodeURIComponent(text); const encodedUrl = encodeURIComponent(GAME_URL);
    shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${TWITTER_HASHTAGS}`;
    shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}"e=${encodedText}`;
}
function copyShareLink(event) {
    event.preventDefault(); event.stopPropagation();
    const textToCopy = BASE_SHARE_TEXT.replace('{score}', score) + ` Play here: ${GAME_URL}`;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => { copyFeedbackEl.textContent = 'Copied!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); }).catch(err => { console.error('Clipboard API copy failed: ', err); copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); });
    } else {
        try {
            const textArea = document.createElement("textarea"); textArea.value = textToCopy; textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
            copyFeedbackEl.textContent = 'Copied! (fallback)'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500);
        } catch (err) { console.error('Fallback copy method failed: ', err); copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); }
    }
}
shareTwitterBtn.addEventListener('click', (e) => { updateShareData(score); }); shareFacebookBtn.addEventListener('click', (e) => { updateShareData(score); });
copyLinkBtn.addEventListener('click', copyShareLink); copyLinkBtn.addEventListener('touchstart', copyShareLink);

// --- Initial Setup ---
function attemptInit() {
    // Only initialize if all assets are processed AND the game hasn't already been initialized/started
    if (assetsLoaded >= totalAssets && (typeof gameState === 'undefined' || gameState === 'loading')) {
        console.log("Assets ready, setting game state to 'initializing'");
        gameState = 'initializing';
        initGame(); // Initialize game variables and UI
    } else if (typeof gameState === 'undefined') {
        // If assets aren't ready yet, mark state as loading
        console.log("Assets not ready yet, setting state to 'loading'");
        gameState = 'loading';
    }
}
// Fallback timeout: Attempt to initialize after 3 seconds
setTimeout(() => {
    if (typeof gameState === 'undefined' || gameState === 'loading') {
        console.warn("Asset load timeout (3s). Forcing initialization attempt.");
        attemptInit();
    }
}, 3000);

// Initial check when script loads
attemptInit();
