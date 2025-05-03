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
// Toggle Checkboxes
const hitboxToggleCheckbox = document.getElementById('hitboxToggle');
const muteToggleCheckbox = document.getElementById('muteToggle');
// Notification Toast Elements
const notificationToast = document.getElementById('achievement-notification'); // Renamed variable
const notificationMessage1 = document.getElementById('achievement-name');    // Will hold primary message
const notificationMessage2 = document.getElementById('achievement-desc');    // Will hold secondary (optional)
// High Score Elements
const highScoreDisplayStart = document.getElementById('high-score-display-start');
const highScoreDisplayEnd = document.getElementById('high-score-display-end');


// --- Load Game Assets ---
const playerImg = new Image(); playerImg.src = 'vezenkov.png';
const obstacleTopImg = new Image(); obstacleTopImg.src = 'obstacle_top.png';
const obstacleBottomImg = new Image(); obstacleBottomImg.src = 'obstacle_bottom.png';
const backgroundImg = new Image(); backgroundImg.src = 'basketball-court-full.jpg';
// Load Sounds
const flapSound = new Audio('sounds/flap.mp3');
const scoreSound = new Audio('sounds/score.mp3');
const crashSound = new Audio('sounds/crash.mp3');
const clickSound = new Audio('sounds/click.wav');
const backgroundMusic = new Audio('sounds/music.mp3');
backgroundMusic.loop = true;

let assetsLoaded = 0;
let totalAssets = 4; // Count only essential images

[flapSound, scoreSound, crashSound, clickSound, backgroundMusic].forEach(sound => {
    sound.load(); // Request browser load
});

function assetLoaded(assetName, success) {
    assetsLoaded++; console.log(`Asset "${assetName}" ${success ? 'loaded' : 'FAILED'}. (${assetsLoaded}/${totalAssets})`);
    if (assetsLoaded >= totalAssets) { console.log("All essential image assets processed, attempting init."); attemptInit(); }
}
playerImg.onload = () => assetLoaded('player', true); obstacleTopImg.onload = () => assetLoaded('obstacleTop', true); obstacleBottomImg.onload = () => assetLoaded('obstacleBottom', true); backgroundImg.onload = () => assetLoaded('background', true);
playerImg.onerror = () => assetLoaded('player', false); obstacleTopImg.onerror = () => assetLoaded('obstacleTop', false); obstacleBottomImg.onerror = () => assetLoaded('obstacleBottom', false); backgroundImg.onerror = () => assetLoaded('background', false);


// --- Share Configuration ---
const GAME_URL = window.location.href;
const BASE_SHARE_TEXT = "Drew {score} fouls with Vezenkov in Flappy Flopper! 🏀 Getting hyped for the #EuroLeague #F4GLORY. Can you flop better? 😉";
const TWITTER_HASHTAGS = "FlappyFlopper,paobc,olympiacosbc";
const SHARE_TITLE = "Flappy Flopper Score!";

// --- Local Storage Keys ---
const HIGH_SCORE_KEY = 'flappyFlopperHighScore_v1';
const MUTE_STATE_KEY = 'flappyFlopperMute_v1';
// Removed ACHIEVEMENTS_KEY

// Game variables
let player; let obstacles; let score; let gravity; let lift; let gameSpeed; let gameState; let frameCount; let sourceBackgroundX = 0; const BACKGROUND_PAN_SPEED_FACTOR = 0.8; let backgroundDirection = 1; let showHitboxes = false;
let highScore = 0;
let isMuted = false; // State variable
// Removed unlockedAchievements
let notificationTimeout = null; // Renamed from achievementTimeout

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

// Removed Achievements Definition

// --- NEW: Encouragement Messages Array ---
const encouragingMessages = [
    "Nice flop! Keep diving!", "Such grace! Such finesse!", "Gravity? Never heard of her.",
    "Did you even *see* the hand?", "Textbook execution... almost.", "Wow. Just... wow.",
    "Are you *trying* to hit them?", "Impressive air time!", "That looked intentional.",
    "Keep up the... effort!", "Someone's been practicing!", "Smooth moves.",
    "Like a leaf on the wind.", "Focused. Determined. Flopping.", "Is this your final form?",
];

// Linear interpolation function
function lerp(start, end, t) {
    t = Math.max(0, Math.min(1, t));
    if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
        console.error("Invalid input to lerp:", start, end, t); return start;
    }
    return start + (end - start) * t;
}

// --- Sound Playback Function ---
function playSound(sound) {
    if (sound && !isMuted) {
        sound.currentTime = 0;
        sound.play().catch(e => {
            if (e.name !== 'NotAllowedError' && e.name !== 'NotSupportedError') {
                 console.log("Sound play failed:", sound.src, e);
            }
        });
    }
}

// --- MUTE LOGIC (Tied to Checkbox) ---
function handleMuteToggleChange(event) {
    if (event && event.target) {
        isMuted = event.target.checked; // Update state from checkbox
        localStorage.setItem(MUTE_STATE_KEY, isMuted);
        console.log("Mute Toggled via checkbox. New state:", isMuted);
        applyMuteState();
        playSound(clickSound); // Play click sound respecting new mute state
    }
}

// --- Apply Mute State ---
function applyMuteState() {
    backgroundMusic.muted = isMuted; // Mute/unmute the Audio element
    if (isMuted) {
        backgroundMusic.pause();
    } else {
        if (gameState === 'playing') { // Only play if game is active
             backgroundMusic.play().catch(e => {
                 if (e.name !== 'NotAllowedError') console.log("Music play failed on applyMuteState:", e);
             });
        }
    }
    console.log("Mute state applied via applyMuteState. Is Muted:", isMuted);
}

// --- Load Game State ---
function loadGameState() {
    // Load High Score
    const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
    highScore = storedHighScore ? parseInt(storedHighScore, 10) : 0;
    if (isNaN(highScore)) highScore = 0;
    console.log("Loaded High Score:", highScore);
    // Load Mute State (Default to Muted)
    const storedMuteState = localStorage.getItem(MUTE_STATE_KEY);
    if (storedMuteState === null) {
        isMuted = true; // Default to muted on first load/reset
        console.log("Mute State: No setting found, defaulting to Muted (true).");
    } else {
        isMuted = storedMuteState === 'true'; // Load saved setting
        console.log("Loaded Mute State from localStorage:", storedMuteState, " Parsed as:", isMuted);
    }
    // Removed Achievement Loading
}

// Removed Save Achievements Function

// --- Show Notification Toast Function ---
function showNotificationToast(messageLine1, messageLine2 = "") {
    console.log(`Showing Notification: "${messageLine1}" ${messageLine2 ? ` / "${messageLine2}"` : ''}`);
    if (notificationToast && notificationMessage1 && notificationMessage2) {
        notificationMessage1.textContent = messageLine1;
        notificationMessage2.textContent = messageLine2;
        notificationToast.classList.remove('hidden');
        void notificationToast.offsetWidth; // Reflow
        notificationToast.classList.add('visible');
        if (notificationTimeout) clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            notificationToast.classList.remove('visible');
             setTimeout(() => { notificationToast.classList.add('hidden'); }, 400); // Match CSS
        }, 2500); // Display duration
    } else { console.error("Notification toast elements not found!"); }
}

// Removed Check Achievements Function

// --- Core Functions ---
function initGame() {
    console.log("Initializing game...");
    loadGameState(); // Load saved states

    // Reset game variables
    player = { x: 50, y: canvas.height / 2 - PLAYER_HEIGHT / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, velocityY: 0, scale: 1 }; // Removed firstFlopDone
    obstacles = []; score = 0; gravity = 0.25; lift = -6; gameSpeed = 1.8; gameState = 'start'; frameCount = 0; sourceBackgroundX = 0; backgroundDirection = 1;

    // Reset UI Elements
    scoreDisplay.textContent = `Fouls Drawn: 0`; scoreDisplay.classList.remove('pop'); gameOverScreen.classList.remove('visible'); startScreen.classList.add('visible'); scoreDisplay.style.display = 'none'; copyFeedbackEl.classList.remove('visible'); pageWrapper.classList.remove('shake');
    // Update High Score Display
    if (highScoreDisplayStart) highScoreDisplayStart.textContent = `Your Best: ${highScore}`;
    if (highScoreDisplayEnd) highScoreDisplayEnd.textContent = `Your Best: ${highScore}`;
    // Apply loaded mute state to audio elements
    applyMuteState();
    // Ensure notification toast is hidden
    if (notificationToast) { notificationToast.classList.remove('visible'); notificationToast.classList.add('hidden'); }
    if (notificationTimeout) { clearTimeout(notificationTimeout); notificationTimeout = null; }

    // Set initial state of toggle checkboxes
    if (hitboxToggleCheckbox) { hitboxToggleCheckbox.checked = showHitboxes; }
    else { console.error("Hitbox toggle checkbox not found!"); }
    if (muteToggleCheckbox) { muteToggleCheckbox.checked = isMuted; console.log("Setting mute checkbox initial state to:", isMuted); }
    else { console.error("Mute toggle checkbox not found!"); }

    // Share Button Visibility Setup
    console.log(`Checking navigator.share support. HTTPS?: ${window.location.protocol === 'https:'}`);
    if (navigator.share && typeof navigator.share === 'function' && window.location.protocol === 'https:') {
        console.log("Web Share API supported."); if (shareNativeBtn) { shareNativeBtn.classList.remove('hidden'); } else { console.error("Native Share button not found!"); } fallbackShareButtons.forEach(btn => { if (btn) btn.classList.add('hidden'); }); console.log("Native Share shown, fallback hidden.");
    } else {
        console.log("Web Share API *not* supported or context insecure. Showing fallback."); if (shareNativeBtn) { shareNativeBtn.classList.add('hidden'); } else { console.error("Native Share button not found!"); } fallbackShareButtons.forEach(btn => { if (btn) btn.classList.remove('hidden'); }); console.log("Native Share hidden, fallback shown.");
    }

    // Initial draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
}

function startGame() {
    if (gameState === 'start') {
        console.log("Starting game...");
        gameState = 'playing';
        startScreen.classList.remove('visible');
        scoreDisplay.style.display = 'block';
        player.velocityY = lift; // Initial lift
        playSound(flapSound); // Play first flap sound
        if (!isMuted) { // Start music if not muted
            backgroundMusic.play().catch(e => {
                if (e.name !== 'NotAllowedError') console.log("Music play failed on startGame:", e);
            });
        }
        playerFlop(); // Trigger initial flop visual
        gameLoop();
    }
}

function endGame() {
    if (gameState === 'playing') {
        console.log("Game Over. Final Score:", score);
        gameState = 'gameOver';
        backgroundMusic.pause(); backgroundMusic.currentTime = 0;
        playSound(crashSound);
        gameOverScreen.classList.add('visible');
        finalScoreDisplay.textContent = score;
        // Check/Update High Score
        if (score > highScore) { highScore = score; localStorage.setItem(HIGH_SCORE_KEY, highScore); console.log("New High Score Recorded!", highScore); if (highScoreDisplayEnd) highScoreDisplayEnd.innerHTML = `Your Best: ${highScore} <span style="color: #FFD700;">(New!)</span>`; } else { if (highScoreDisplayEnd) highScoreDisplayEnd.textContent = `Your Best: ${highScore}`; }
        // Game Over Message
        const messages = [ "Technical Foul!", "Yellow Card for Diving!", "And the Oscar goes to...", "He felt that one!", "Called for Traveling (sideways)!", "Flopped too hard!", "Ref didn't buy it!", "Barely clipped a fingernail!", "Looked like a gust of wind took him out!", "Needs more drama classes.", "Gravity seems selective today.", "Did he practice that fall?", "Someone check the replay... oh wait.", "Clutching the wrong body part!", "He's selling it like prime real estate!", "Where's the stretcher?! ...Never mind.", "A flop worthy of the highlight reel.", "The simulation detected excessive simulation.", "Even the commentators are laughing.", "Pulled a hamstring... from the acting.", "Was there a sniper in the rafters?", "The breeze from the A/C strikes again!", "He went down like he was hit by... air?", "That's commitment to the bit!", "The delay on that reaction was... *chef's kiss*.", "Looks like a career-ender... oh, he's up. Never mind.", "Newton's laws are merely suggestions, apparently.", "The physics engine needs a reboot after that one.", "Even his shadow looked confused.", "He'll feel that one... in the film session tomorrow.", "Trying to draw the foul from the parking lot.", "Impressive hangtime... on the way down.", "He absorbed that contact like it was made of pillows.", "Someone check his shoes for banana peels.", "That's going straight to the 'Not Top 10'.", "He's appealing to the ref... and maybe the judges.", "Lost the battle with gravity... decisively.", "Did an invisible defender just trip him?", "A masterclass in simulation. 2/10 execution.", "The floor appears to be undefeated tonight." ];
        gameOverMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
        // Screen shake
        pageWrapper.classList.add('shake'); setTimeout(() => { pageWrapper.classList.remove('shake'); }, 150);
        // Removed crash achievement check
        prepareShareData(score);
    }
}

function playerFlop() { // Simplified - removed achievement check
    if (gameState === 'playing') {
        player.velocityY = lift;
        player.scale = 1.15;
        playSound(flapSound);
    }
}

function isColliding(rect1, rect2) {
    if (!rect1 || !rect2 || typeof rect1.x !== 'number' || typeof rect1.y !== 'number' || typeof rect1.width !== 'number' || typeof rect1.height !== 'number' || typeof rect2.x !== 'number' || typeof rect2.y !== 'number' || typeof rect2.width !== 'number' || typeof rect2.height !== 'number') { return false; }
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}

function update() {
    if (gameState !== 'playing') return;

    // Background Panning
    if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) { const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; const sourceDrawWidth = canvas.width / bgScaleFactor; if (backgroundImg.naturalWidth > sourceDrawWidth) { let panAmount = gameSpeed * BACKGROUND_PAN_SPEED_FACTOR * backgroundDirection; sourceBackgroundX += panAmount; const maxSourceX = backgroundImg.naturalWidth - sourceDrawWidth; if (sourceBackgroundX >= maxSourceX) { sourceBackgroundX = maxSourceX; backgroundDirection = -1; } else if (sourceBackgroundX <= 0) { sourceBackgroundX = 0; backgroundDirection = 1; } } else { sourceBackgroundX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); } }
    // Player Physics
    player.velocityY += gravity; player.y += player.velocityY; if (player.y < 0) { player.y = 0; player.velocityY = 0; } if (player.y + player.height > canvas.height) { player.y = canvas.height - player.height; endGame(); return; } if (player.scale > 1) { player.scale -= 0.05; if (player.scale < 1) player.scale = 1; } else { player.scale = 1; }
    // Difficulty Progression & Spawn Rate
    const difficultyProgress = Math.min(1, score / MAX_SCORE_FOR_DIFFICULTY); const currentSpawnRate = Math.round(lerp(INITIAL_SPAWN_RATE, FINAL_SPAWN_RATE, difficultyProgress));

    // Obstacle Update, Collision & Scoring
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i]; obs.x -= gameSpeed;
        const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
        const currentTopHeight = obstacleTopImg.naturalHeight || obs.topImageHeight || OBSTACLE_IMG_HEIGHT; const currentBottomHeight = obstacleBottomImg.naturalHeight || obs.bottomImageHeight || OBSTACLE_IMG_HEIGHT;
        obs.currentTopImageY = obs.baseTopY; obs.currentBottomImageY = obs.baseBottomY;
        obs.hitboxRects = [ { x: obs.x, y: obs.currentTopImageY, width: obs.width, height: currentTopHeight }, { x: obs.x, y: obs.currentBottomImageY, width: obs.width, height: currentBottomHeight } ];
        if (isColliding(playerRect, obs.hitboxRects[0]) || isColliding(playerRect, obs.hitboxRects[1])) { endGame(); return; }

        // Score Increment & Notification Trigger
        if (!obs.passed && obs.x + obs.width < player.x) {
            obs.passed = true; score++;
            scoreDisplay.textContent = `Fouls Drawn: ${score}`;
            scoreDisplay.classList.add('pop'); setTimeout(() => { scoreDisplay.classList.remove('pop'); }, 150);
            // Play score sound (whistle) on 1st and every 5th foul
            if (score === 1 || (score > 0 && score % 5 === 0)) { playSound(scoreSound); }
            // Show encouragement message on 2nd, 6th, 10th, etc. foul
            if (score === 2 || (score > 2 && (score - 2) % 4 === 0)) {
                const randomIndex = Math.floor(Math.random() * encouragingMessages.length);
                showNotificationToast(encouragingMessages[randomIndex]);
            }
            // Removed old achievement check
            // Increase speed
            if (score > 0 && score % 8 === 0) { gameSpeed += 0.05; console.log("Speed increased to:", gameSpeed.toFixed(2)); }
        }
        // Remove off-screen obstacles
        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); }
    }

    // Spawn New Obstacles
    if (frameCount % currentSpawnRate === 0) { const currentGapHeight = lerp(INITIAL_GAP_HEIGHT, FINAL_GAP_HEIGHT, difficultyProgress); const topGapY = Math.random() * (MAX_GAP_TOP_Y - MIN_OBSTACLE_Y_MARGIN) + MIN_OBSTACLE_Y_MARGIN; const bottomGapY = topGapY + currentGapHeight; const topImageActualHeight = obstacleTopImg.naturalHeight || OBSTACLE_IMG_HEIGHT; const bottomImageActualHeight = obstacleBottomImg.naturalHeight || OBSTACLE_IMG_HEIGHT; const topImageY = topGapY - topImageActualHeight; const bottomImageY = bottomGapY; obstacles.push({ x: canvas.width, width: OBSTACLE_WIDTH, baseTopY: topImageY, topImageHeight: topImageActualHeight, baseBottomY: bottomImageY, bottomImageHeight: bottomImageActualHeight, currentTopImageY: topImageY, currentBottomImageY: bottomImageY, passed: false, hitboxRects: [{}, {}] }); }
    frameCount++;
}

// --- Drawing Functions --- (Keep existing: drawBackground, drawPlayer, drawObstacles, draw)
function drawBackground() { if (backgroundImg.complete && backgroundImg.naturalWidth > 0 && backgroundImg.naturalHeight > 0) { const bgScaleFactor = canvas.height / backgroundImg.naturalHeight; const sourceDrawWidth = canvas.width / bgScaleFactor; let clampedSourceX = Math.max(0, sourceBackgroundX); if (backgroundImg.naturalWidth > sourceDrawWidth) { clampedSourceX = Math.min(clampedSourceX, backgroundImg.naturalWidth - sourceDrawWidth); } else { clampedSourceX = Math.max(0, (backgroundImg.naturalWidth - sourceDrawWidth) / 2); } ctx.drawImage( backgroundImg, clampedSourceX, 0, sourceDrawWidth, backgroundImg.naturalHeight, 0, 0, canvas.width, canvas.height ); ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; ctx.fillRect(0, 0, canvas.width, canvas.height); } else { const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height); gradient.addColorStop(0, "#282c34"); gradient.addColorStop(1, "#1f232a"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); } }
function drawPlayer() { if (!player) return; if (playerImg.complete && playerImg.naturalWidth !== 0) { const scaledWidth = player.width * player.scale; const scaledHeight = player.height * player.scale; ctx.save(); ctx.translate(player.x + player.width / 2, player.y + player.height / 2); let angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, player.velocityY * 0.08)); ctx.rotate(angle); ctx.drawImage(playerImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight); ctx.restore(); } else { ctx.fillStyle = 'red'; ctx.fillRect(player.x, player.y, player.width, player.height); } if (showHitboxes) { ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)'; ctx.lineWidth = 1; ctx.strokeRect(player.x, player.y, player.width, player.height); } }
function drawObstacles() { obstacles.forEach(obstacle => { const currentTopHeight = obstacle.topImageHeight || OBSTACLE_IMG_HEIGHT; const currentBottomHeight = obstacle.bottomImageHeight || OBSTACLE_IMG_HEIGHT; if (obstacleTopImg.complete && obstacleTopImg.naturalWidth > 0) { ctx.drawImage(obstacleTopImg, obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentTopImageY, obstacle.width, currentTopHeight); } if (obstacleBottomImg.complete && obstacleBottomImg.naturalWidth > 0) { ctx.drawImage(obstacleBottomImg, obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); } else { ctx.fillStyle = '#D2691E'; ctx.fillRect(obstacle.x, obstacle.currentBottomImageY, obstacle.width, currentBottomHeight); } if (showHitboxes && obstacle.hitboxRects && obstacle.hitboxRects.length === 2) { ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; if (obstacle.hitboxRects[0] && typeof obstacle.hitboxRects[0].width === 'number') { ctx.fillRect(obstacle.hitboxRects[0].x, obstacle.hitboxRects[0].y, obstacle.hitboxRects[0].width, obstacle.hitboxRects[0].height); } if (obstacle.hitboxRects[1] && typeof obstacle.hitboxRects[1].width === 'number') { ctx.fillRect(obstacle.hitboxRects[1].x, obstacle.hitboxRects[1].y, obstacle.hitboxRects[1].width, obstacle.hitboxRects[1].height); } } }); }
function draw() { ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); drawObstacles(); if (player) { drawPlayer(); } }

// --- gameLoop function ---
function gameLoop() { if (gameState !== 'playing') return; update(); draw(); requestAnimationFrame(gameLoop); }

// --- Event Listeners ---
function handleInput(event) { event.preventDefault(); if (gameState === 'start') { if (!isMuted && backgroundMusic.paused) { backgroundMusic.play().catch(e => { if (e.name !== 'NotAllowedError') console.log("Initial music play failed on input:", e); }); } startGame(); } else if (gameState === 'playing') { playerFlop(); } }
if (gameContainer) { gameContainer.addEventListener('mousedown', handleInput); gameContainer.addEventListener('touchstart', handleInput); } else { console.error("Game container element not found!"); }
document.addEventListener('keydown', function(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleInput(e); } });

function handleRestart(event) { event.preventDefault(); event.stopPropagation(); console.log("Restart button activated"); playSound(clickSound); initGame(); }
if (restartButton) { restartButton.addEventListener('click', handleRestart); restartButton.addEventListener('touchstart', handleRestart); } else { console.error("Restart button not found!"); }

// Hitbox Toggle Listener (Removed achievement check)
function handleHitboxToggleChange(event) { if (event && event.target) { showHitboxes = event.target.checked; console.log("Show Hitboxes Toggled:", showHitboxes); playSound(clickSound); } }
if (hitboxToggleCheckbox) { hitboxToggleCheckbox.addEventListener('change', handleHitboxToggleChange); } else { console.error("Hitbox toggle checkbox not found!"); }

// Mute Toggle Checkbox Listener
if (muteToggleCheckbox) { muteToggleCheckbox.addEventListener('change', handleMuteToggleChange); } else { console.error("Mute toggle checkbox not found!"); }

// --- Share Functionality --- (Keep existing: prepareShareData, handleNativeShare, copyShareLink, listeners)
function prepareShareData(currentScore) { const text = BASE_SHARE_TEXT.replace('{score}', currentScore); const encodedText = encodeURIComponent(text); const encodedUrl = encodeURIComponent(GAME_URL); if (shareTwitterBtn) { shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${TWITTER_HASHTAGS}`; } if (shareFacebookBtn) { shareFacebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}"e=${encodedText}`; } if (shareNativeBtn) { shareNativeBtn.dataset.shareTitle = SHARE_TITLE; shareNativeBtn.dataset.shareText = text; shareNativeBtn.dataset.shareUrl = GAME_URL; } }
async function handleNativeShare(event) { event.preventDefault(); playSound(clickSound); const target = event.currentTarget || event.target; const targetDataset = target?.dataset; if (!targetDataset || !targetDataset.shareText || !targetDataset.shareUrl) { console.error("Share data missing. Re-preparing..."); prepareShareData(score); if (!targetDataset.shareText || !targetDataset.shareUrl) { console.error('Still missing share data.'); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Share Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 2000); } return; } } const shareData = { title: targetDataset.shareTitle || document.title, text: targetDataset.shareText, url: targetDataset.shareUrl }; console.log("Attempting Web Share:", shareData); try { await navigator.share(shareData); console.log('Shared successfully'); } catch (err) { console.error('Error sharing:', err); if (copyFeedbackEl && err.name !== 'AbortError'){ copyFeedbackEl.textContent = 'Share failed!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 2000); } } }
function copyShareLink(event) { event.preventDefault(); event.stopPropagation(); playSound(clickSound); prepareShareData(score); const textToCopy = (shareNativeBtn?.dataset?.shareText || BASE_SHARE_TEXT.replace('{score}', score)) + ` Play here: ${GAME_URL}`; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(() => { if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copied!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } console.log('Copied via Clipboard API.'); }).catch(err => { console.error('Clipboard API copy failed: ', err); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copy Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } }); } else { console.warn("Using fallback copy method."); try { const textArea = document.createElement("textarea"); textArea.value = textToCopy; textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); const successful = document.execCommand('copy'); document.body.removeChild(textArea); if (successful) { if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copied! (fallback)'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } console.log('Copied via fallback.'); } else { throw new Error('execCommand failed'); } } catch (err) { console.error('Fallback copy failed: ', err); if(copyFeedbackEl){ copyFeedbackEl.textContent = 'Copy Error!'; copyFeedbackEl.classList.add('visible'); setTimeout(() => { copyFeedbackEl.classList.remove('visible'); }, 1500); } } } }
// Add Share Listeners
if (navigator.share && typeof navigator.share === 'function' && shareNativeBtn) { shareNativeBtn.addEventListener('click', handleNativeShare); }
if (shareTwitterBtn) { shareTwitterBtn.addEventListener('click', (e) => { playSound(clickSound); prepareShareData(score); }); } else { console.error("Twitter Share button not found!"); }
if (shareFacebookBtn) { shareFacebookBtn.addEventListener('click', (e) => { playSound(clickSound); prepareShareData(score); }); } else { console.error("Facebook Share button not found!"); }
if (copyLinkBtn) { copyLinkBtn.addEventListener('click', copyShareLink); copyLinkBtn.addEventListener('touchstart', copyShareLink); } else { console.error("Copy link button not found!"); }

// --- Initial Setup ---
function attemptInit() { if (assetsLoaded >= totalAssets && (typeof gameState === 'undefined' || gameState === 'loading')) { console.log("Assets ready, initializing"); gameState = 'initializing'; initGame(); } else if (typeof gameState === 'undefined') { console.log("Assets not ready, loading"); gameState = 'loading'; } }
setTimeout(() => { if (typeof gameState === 'undefined' || gameState === 'loading') { console.warn("Asset load timeout (3s). Forcing init attempt."); attemptInit(); } }, 3000);
attemptInit(); // Start