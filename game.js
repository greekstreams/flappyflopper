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
const pageWrapper = document.querySelector('.page-wrapper');
// Share Elements
const shareNativeBtn = document.getElementById('share-native');
const shareTwitterBtn = document.getElementById('share-twitter');
const shareFacebookBtn = document.getElementById('share-facebook');
const copyLinkBtn = document.getElementById('copy-link');
const copyFeedbackEl = document.getElementById('copy-feedback');
const fallbackShareButtons = document.querySelectorAll('.fallback-share');
// Hitbox Toggle Checkbox
const hitboxToggleCheckbox = document.getElementById('hitboxToggle');


// --- Load Game Assets ---
const playerImg = new Image(); playerImg.src = 'vezenkov.png';
const obstacleTopImg = new Image(); obstacleTopImg.src = 'obstacle_top.png';
const obstacleBottomImg = new Image(); obstacleBottomImg.src = 'obstacle_bottom.png';
const backgroundImg = new Image(); backgroundImg.src = 'basketball-court-full.jpg';

let assetsLoaded = 0; let totalAssets = 4;

function assetLoaded(assetName, success) {
    assetsLoaded++; console.log(`Asset "${assetName}" ${success ? 'loaded' : 'FAILED'}. (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded >= totalAssets) { console.log("All essential assets processed, attempting init."); attemptInit(); }
}
playerImg.onload = () => assetLoaded('player', true); obstacleTopImg.onload = () => assetLoaded('obstacleTop', true); obstacleBottomImg.onload = () => assetLoaded('obstacleBottom', true); backgroundImg.onload = () => assetLoaded('background', true);
playerImg.onerror = () => assetLoaded('player', false); obstacleTopImg.onerror = () => assetLoaded('obstacleTop', false); obstacleBottomImg.onerror = () => assetLoaded('obstacleBottom', false); backgroundImg.onerror = () => assetLoaded('background', false);

// --- Share Configuration ---
const GAME_URL = window.location.href;
const BASE_SHARE_TEXT = "Drew {score} fouls with Vezenkov in Flappy Flopper! 🏀 Getting hyped for the #EuroLeague #F4GLORY. Can you flop better? 😉";
const TWITTER_HASHTAGS = "FlappyFlopper,paobc,olympiacosbc";
const SHARE_TITLE = "Flappy Flopper Score!";

// Game variables
let player; let obstacles; let score; let gravity; let lift; let gameSpeed; let gameState; let frameCount; let sourceBackgroundX = 0; const BACKGROUND_PAN_SPEED_FACTOR = 0.8; let backgroundDirection = 1; let showHitboxes = false;

// Player settings
const PLAYER_WIDTH = 50; const PLAYER_HEIGHT = 60;
// Difficulty Transition
const MAX_SCORE_FOR_DIFFICULTY = 45;
// Obstacle settings
const OBSTACLE_WIDTH = 114; const OBSTACLE_IMG_HEIGHT = 350;
// Dynamic Gap Size
const INITIAL_GAP_HEIGHT = 190; const FINAL_GAP_HEIGHT = 140; const MIN_OBSTACLE_Y_MARGIN = 50; const MAX_GAP_TOP_Y = canvas.height - FINAL_GAP_HEIGHT - MIN_OBSTACLE_Y_MARGIN;
// Dynamic Obstacle Spacing
const INITIAL_SPAWN_RATE = 180; const FINAL_SPAWN_RATE = 110;

// Linear interpolation function
function lerp(start, end, t) {
    t = Math.max(0, Math.min(1, t)); if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) { console.error("Invalid input to lerp:", start, end, t); return start; } return start + (end - start) * t;
}

// --- Core Functions ---
function initGame() {
    console.log("Initializing game...");
    player = { x: 50, y: canvas.height / 2 - PLAYER_HEIGHT / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, velocityY: 0, scale: 1 }; obstacles = []; score = 0; gravity = 0.25; lift = -6; gameSpeed = 1.8; gameState = 'start'; frameCount = 0; sourceBackgroundX = 0; backgroundDirection = 1;

    // Reset UI
    scoreDisplay.textContent = `Fouls Drawn: 0`; scoreDisplay.classList.remove('pop'); gameOverScreen.classList.remove('visible'); startScreen.classList.add('visible'); scoreDisplay.style.display = 'none'; copyFeedbackEl.classList.remove('visible'); pageWrapper.classList.remove('shake');

    // --- Share Button Visibility Setup ---
    console.log(`Checking navigator.share support. HTTPS?: ${window.location.protocol === 'https:'}`); // Log HTTPS status
    if (navigator.share && typeof navigator.share === 'function') { // Extra check
        console.log("Web Share API seems supported.");
        if (shareNativeBtn) { // Check if element exists
            shareNativeBtn.classList.remove('hidden');
            console.log("Native Share button shown.");
        } else { console.error("Native Share button not found in DOM!"); }

        fallbackShareButtons.forEach(btn => {
            if (btn) btn.classList.add('hidden'); // Check if element exists
        });
        console.log("Fallback buttons hidden.");
    } else {
        console.log("Web Share API *not* supported or is not a function, showing fallback links.");
        if (shareNativeBtn) shareNativeBtn.classList.add('hidden');
        else { console.error("Native Share button not found in DOM!"); }

        fallbackShareButtons.forEach(btn => {
            if (btn) btn.classList.remove('hidden'); // Check if element exists
        });
        console.log("Fallback buttons shown.");
    }

    // Set initial state of the toggle switch
    if (hitboxToggleCheckbox) { hitboxToggleCheckbox.checked = showHitboxes; }
    else { console.error("Hitbox toggle checkbox not found!");}

    ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground();
}

function startGame() { if (gameState === 'start') { console.log("Starting game..."); gameState = 'playing'; startScreen.classList.remove('visible'); scoreDisplay.style.display = 'block'; player.velocityY = lift; playerFlop(); gameLoop(); } }

function endGame() {
    if (gameState !== 'gameOver') {
        console.log("Game Over. Score:", score);
        gameState = 'gameOver';
        gameOverScreen.classList.add('visible');
        finalScoreDisplay.textContent = score;

        // --- UPDATED Messages Array ---
        const messages = [
            "Technical Foul!", // Keep some classics
            "Yellow Card for Diving!",
            "And the Oscar goes to...",
            "He felt that one!",
            "Called for Traveling (sideways)!",
            "Flopped too hard!",
            "Ref didn't buy it!",
            "Barely clipped a fingernail!", // New
            "Looked like a gust of wind took him out!", // New
            "Needs more drama classes.", // New
            "Gravity seems selective today.", // New
            "Did he practice that fall?", // New
            "Someone check the replay... oh wait.", // New
            "Clutching the wrong body part!", // New
            "He's selling it like prime real estate!", // New
            "Where's the stretcher?! ...Never mind.", // New
            "A flop worthy of the highlight reel.", // New
            "The simulation detected excessive simulation.", // New
            "Even the commentators are laughing.", // New
            "Pulled a hamstring... from the acting.", // New
            // --- New Sarcastic Sportscaster Additions ---
            "Was there a sniper in the rafters?",
            "The breeze from the A/C strikes again!",
            "He went down like he was hit by... air?",
            "That's commitment to the bit!",
            "The delay on that reaction was... *chef's kiss*.",
            "Looks like a career-ender... oh, he's up. Never mind.",
            "Newton's laws are merely suggestions, apparently.",
            "The physics engine needs a reboot after that one.",
            "Even his shadow looked confused.",
            "He'll feel that one... in the film session tomorrow.",
            "Trying to draw the foul from the parking lot.",
            "Impressive hangtime... on the way down.",
            "He absorbed that contact like it was made of pillows.",
            "Someone check his shoes for banana peels.",
            "That's going straight to the 'Not Top 10'.",
            "He's appealing to the ref... and maybe the judges.",
            "Lost the battle with gravity... decisively.",
            "Did an invisible defender just trip him?",
            "A masterclass in simulation. 2/10 execution.",
            "The floor appears to be undefeated tonight."
        ];
        // --- End UPDATED Messages ---

        gameOverMessage.textContent = messages[Math.floor(Math.random() * messages.length)];

        // Add shake effect to the page wrapper
        pageWrapper.classList.add('shake');
        setTimeout(() => { pageWrapper.classList.remove('shake'); }, 150);

        // Prepare share data when game ends
        prepareShareData(score);
    }
}

function playerFlop() { if (gameState === 'playing') { player.velocityY = lift; player.scale = 1.15; } }

function isColliding(rect1, rect2) { if (!rect1 || !rect2 || !rect1.width || !rect1.height || !rect2.width || !rect2.height) return false; return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y; }

function update() {
    if (gameState !== 'playing') return;

    // --- Background Panning ---
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) { const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; const sourceDrawWidth = canvas.width / bgScaleFactor; if (backgroundImg.naturalWidth > sourceDrawWidth) { let panAmount = gameSpeed * BACKGROUND_PAN_SPEED_FACTOR * backgroundDirection; sourceBackgroundX += panAmount; const maxSourceX = backgroundImg.naturalWidth - sourceDrawWidth; if (sourceBackgroundX >= maxSourceX) { sourceBackgroundX = maxSourceX; backgroundDirection = -1; } else if (sourceBackgroundX <= 0) { sourceBackgroundX = 0; backgroundDirection = 1; } } else { sourceBackgroundX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); } }

    // --- Player Physics ---
    player.velocityY += gravity; player.y += player.velocityY; if (player.y < 0) { player.y = 0; player.velocityY = 0; } if (player.y + player.height > canvas.height) { player.y = canvas.height - player.height; endGame(); return; } if (player.scale > 1) { player.scale -= 0.05; if (player.scale < 1) player.scale = 1; } else { player.scale = 1; }

    // --- Difficulty Progress & Spawn Rate ---
    const difficultyProgress = Math.min(1, score / MAX_SCORE_FOR_DIFFICULTY); const currentSpawnRate = Math.round(lerp(INITIAL_SPAWN_RATE, FINAL_SPAWN_RATE, difficultyProgress));

    // --- Obstacle Logic ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i]; obs.x -= gameSpeed; const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
        if (typeof obs.currentTopImageY === 'undefined') obs.currentTopImageY = obs.baseTopY; if (typeof obs.currentBottomImageY === 'undefined') obs.currentBottomImageY = obs.baseBottomY; const currentTopHeight = obstacleTopImg.naturalHeight || obs.topImageHeight || OBSTACLE_IMG_HEIGHT; const currentBottomHeight = obstacleBottomImg.naturalHeight || obs.bottomImageHeight || OBSTACLE_IMG_HEIGHT;
        obs.hitboxRects = [{ x: obs.x, y: obs.currentTopImageY, width: obs.width, height: currentTopHeight }, { x: obs.x, y: obs.currentBottomImageY, width: obs.width, height: currentBottomHeight }];
        if (isColliding(playerRect, obs.hitboxRects[0]) || isColliding(playerRect, obs.hitboxRects[1])) { endGame(); return; }
        if (!obs.passed && obs.x + obs.width < player.x) { obs.passed = true; score++; scoreDisplay.textContent = `Fouls Drawn: ${score}`; scoreDisplay.classList.add('pop'); setTimeout(() => { scoreDisplay.classList.remove('pop'); }, 150); if (score > 0 && score % 8 === 0) { gameSpeed += 0.05; console.log("Speed increased to:", gameSpeed.toFixed(2)); } }
        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); }
    }

    // --- Spawn New Obstacles ---
    if (frameCount % currentSpawnRate === 0) { const currentGapHeight = lerp(INITIAL_GAP_HEIGHT, FINAL_GAP_HEIGHT, difficultyProgress); const topGapY = Math.random() * (MAX_GAP_TOP_Y - MIN_OBSTACLE_Y_MARGIN) + MIN_OBSTACLE_Y_MARGIN; const bottomGapY = topGapY + currentGapHeight; const topImageActualHeight = obstacleTopImg.naturalHeight || OBSTACLE_IMG_HEIGHT; const bottomImageActualHeight = obstacleBottomImg.naturalHeight || OBSTACLE_IMG_HEIGHT; const topImageY = topGapY - topImageActualHeight; const bottomImageY = bottomGapY; obstacles.push({ x: canvas.width, width: OBSTACLE_WIDTH, baseTopY: topImageY, topImageHeight: topImageActualHeight, baseBottomY: bottomImageY, bottomImageHeight: bottomImageActualHeight, currentTopImageY: topImageY, currentBottomImageY: bottomImageY, passed: false, hitboxRects: [{}, {}] }); }
    frameCount++;
}

// --- Drawing Functions ---
function drawBackground() { if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) { const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; const sourceDrawWidth = canvas.width / bgScaleFactor; let clampedSourceX = Math.max(0, sourceBackgroundX); if (backgroundImg.naturalWidth > sourceDrawWidth) { clampedSourceX = Math.min(clampedSourceX, backgroundImg.naturalWidth - sourceDrawWidth); } else { clampedSourceX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); } ctx.drawImage(backgroundImg, clampedSourceX, 0, sourceDrawWidth, backgroundImg.naturalHeight, 0, 0, canvas.width, canvas.height); ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height); } else { const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height); gradient.addColorStop(0, "#282c34"); gradient.addColorStop(1, "#1f232a"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); } }
function drawPlayer() { if (!player) return; if (playerImg.complete && playerImg.naturalWidth !== 0) { const scaledWidth = player.width * player.scale; const scaledHeight = player.height * player.scale; ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2); let angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, player.velocityY * 0.08)); ctx.rotate(angle); ctx.drawImage(playerImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight); ctx.restore(); } else { ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, player.width, player.height); } }
function drawObstacles() { obstacles.forEach(obstacle => { const currentTopHeight = obstacleTopImg.naturalHeight || obstacle.topImageHeight || OBSTACLE_IMG_HEIGHT; const currentBottomHeight = obstacleBottomImg.naturalHeight || obstacle.bottomImageHeight || OBSTACLE_IMG_HEIGHT; if (obstacleTopImg.complete && obstacleTopImg.naturalWidth > 0) { ctx.drawImage(obstacleTopImg, obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); } if (obstacleBottomImg.complete && obstacleBottomImg.naturalWidth > 0) { ctx.drawImage(obstacleBottomImg, obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); } if (showHitboxes && obstacle.hitboxRects && obstacle.hitboxRects.length === 2) { ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; if (obstacle.hitboxRects[0] && obstacle.hitboxRects[0].width) { ctx.fillRect(obstacle.hitboxRects[0].x, obstacle.hitboxRects[0].y, obstacle.hitboxRects[0].width, obstacle.hitboxRects[0].height); } if (obstacle.hitboxRects[1] && obstacle.hitboxRects[1].width) { ctx.fillRect(obstacle.hitboxRects[1].x, obstacle.hitboxRects[1].y, obstacle.hitboxRects[1].width, obstacle.hitboxRects[1].height); } } }); }
function draw() { ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); drawObstacles(); if (player) { drawPlayer(); } }
function gameLoop() { if (gameState !== 'playing') return; update(); draw(); requestAnimationFrame(gameLoop); }

// --- Event Listeners ---
function handleInput(event) { event.preventDefault(); if (gameState === 'start') { startGame(); } else if (gameState === 'playing') { playerFlop(); } }
if(gameContainer) { gameContainer.addEventListener('mousedown', handleInput); gameContainer.addEventListener('touchstart', handleInput); } else { console.error("Game container not found!");}
document.addEventListener('keydown', function(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleInput(e); } });
function handleRestart(event) { event.preventDefault(); event.stopPropagation(); console.log("Restart button clicked"); initGame(); }
if(restartButton) { restartButton.addEventListener('click', handleRestart); restartButton.addEventListener('touchstart', handleRestart); } else { console.error("Restart button not found!");}

// --- Hitbox Toggle Listener ---
function handleHitboxToggleChange(event) { if(event && event.target) showHitboxes = event.target.checked; console.log("Show Hitboxes:", showHitboxes); }
if (hitboxToggleCheckbox) { hitboxToggleCheckbox.addEventListener('change', handleHitboxToggleChange); } else { console.error("Hitbox toggle checkbox not found!");}


// --- Share Functionality ---
function prepareShareData(currentScore) {
    const text = BASE_SHARE_TEXT.replace('{score}', currentScore);
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(GAME_URL);
    // Update fallback links
    if (shareTwitterBtn) shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${TWITTER_HASHTAGS}`;
    if (shareFacebookBtn) shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}"e=${encodedText}`;
    // Store data for Web Share API
    if (shareNativeBtn) {
        shareNativeBtn.dataset.shareTitle = SHARE_TITLE;
        shareNativeBtn.dataset.shareText = text;
        shareNativeBtn.dataset.shareUrl = GAME_URL;
    }
}

// --- Native Share Button Listener ---
async function handleNativeShare(event) {
    event.preventDefault();
    // Check if dataset exists on the button clicked
    const targetDataset = event?.target?.dataset;
    if (!targetDataset) {
        console.error("Share button dataset not found.");
        return;
    }
    const shareData = {
        title: targetDataset.shareTitle || document.title,
        text: targetDataset.shareText || '',
        url: targetDataset.shareUrl || window.location.href,
    };
    if (!shareData.text || !shareData.url) {
        console.error('Share data missing from dataset. Attempting re-prepare.');
        prepareShareData(score); // Re-populate dataset
        shareData.text = targetDataset.shareText || ''; // Try reading again
        shareData.url = targetDataset.shareUrl || window.location.href;
        if (!shareData.text || !shareData.url) { // Still missing? Give up.
            if(copyFeedbackEl) { copyFeedbackEl.textContent = 'Share Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 2000); }
            return;
        }
    }
    console.log("Attempting Web Share with:", shareData);
    try {
        await navigator.share(shareData);
        console.log('Shared successfully');
    } catch (err) {
        console.error('Error sharing:', err);
        if (copyFeedbackEl) { copyFeedbackEl.textContent = 'Share failed!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 2000); }
    }
}
// Add listener only if the API is supported and the button exists
if (navigator.share && typeof navigator.share === 'function' && shareNativeBtn) {
    shareNativeBtn.addEventListener('click', handleNativeShare);
    shareNativeBtn.addEventListener('touchstart', handleNativeShare);
}

// --- Fallback Share Button Listeners ---
if (shareTwitterBtn) shareTwitterBtn.addEventListener('click', (e) => { prepareShareData(score); }); else { console.error("Twitter Share button not found!"); }
if (shareFacebookBtn) shareFacebookBtn.addEventListener('click', (e) => { prepareShareData(score); }); else { console.error("Facebook Share button not found!"); }

// --- Copy Link Listener ---
function copyShareLink(event) {
    event.preventDefault(); event.stopPropagation();
    prepareShareData(score); // Ensure data is fresh
    const textToCopy = (shareNativeBtn?.dataset?.shareText || BASE_SHARE_TEXT.replace('{score}', score)) + ` Play here: ${GAME_URL}`;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => { if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copied!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } }).catch(err => { console.error('Clipboard API copy failed: ', err); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } });
    } else {
        try { const textArea = document.createElement("textarea"); textArea.value = textToCopy; textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copied! (fallback)'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } } catch (err) { console.error('Fallback copy method failed: ', err); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } }
    }
}
if (copyLinkBtn) { copyLinkBtn.addEventListener('click', copyShareLink); copyLinkBtn.addEventListener('touchstart', copyShareLink); } else { console.error("Copy link button not found!"); }

// --- Initial Setup ---
function attemptInit() {
    if (assetsLoaded >= totalAssets && (typeof gameState === 'undefined' || gameState === 'loading')) { console.log("Assets ready, setting game state to 'initializing'"); gameState = 'initializing'; initGame(); }
    else if (typeof gameState === 'undefined') { console.log("Assets not ready yet, setting state to 'loading'"); gameState = 'loading'; }
}
setTimeout(() => { if (typeof gameState === 'undefined' || gameState === 'loading') { console.warn("Asset load timeout (3s). Forcing initialization attempt."); attemptInit(); } }, 3000);
attemptInit();
