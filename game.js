
// Get DOM elements
const mainMenu = document.getElementById('main-menu');
const startBtn = document.getElementById('start-btn');
const gameScreen = document.getElementById('game-screen');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const scoreSpan = document.getElementById('score');
const canvas = document.getElementById('game-canvas');

// Get new HUD buttons
const homeBtn = document.getElementById('home-btn');
const resetBtn = document.getElementById('reset-btn');

// Get new DOM elements for difficulty selection and reload tube
const difficultyMenu = document.getElementById('difficulty-menu');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');

// Create a container for the reload tube above the slingshot
let reloadTubeContainer = document.getElementById('reload-tube-container');
if (!reloadTubeContainer) {
    reloadTubeContainer = document.createElement('div');
    reloadTubeContainer.id = 'reload-tube-container';
    document.body.appendChild(reloadTubeContainer);
}
let reloadTube = null;

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    easy: { shots: 5 },
    medium: { shots: 3 },
    hard: { shots: 2 } // Hard now gives 2 water drops
};
let currentDifficulty = 'easy';

// Game state variables
let score = 0;
let shotsLeft = 3;
let levelEnded = false;
let waterDropQueue = []; // Holds the remaining water drops

// Matter.js module aliases
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Constraint = Matter.Constraint;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Events = Matter.Events;

// Matter.js engine and world
let engine;
let world;
let render;

// Game objects
let waterDrop;
let slingshotConstraint;
// Change monster to an array for multiple monsters
let monsters = [];

// These ratios keep the slingshot and monster at the same relative positions
const SLINGSHOT_X_RATIO = 220 / 1200;
const GRASS_HEIGHT_RATIO = 0.18;
const SLINGSHOT_Y_RATIO = (1 - GRASS_HEIGHT_RATIO) - (100 / 600);
const MONSTER_X_RATIO = 950 / 1200;
const MONSTER_Y_RATIO = (1 - GRASS_HEIGHT_RATIO) - (35 / 600);

// Set base reference width/height for scaling
const BASE_WIDTH = 1200;
const BASE_HEIGHT = 600;

let slingshotPoint = { x: 0, y: 0 };
const maxPullDistance = 120; // Keep the same pull-back

// Use a negative collision group for slingshot and water drop so they never collide
const SLINGSHOT_GROUP = -2;

// Store all launched water drops for collision detection

// --- UI FLOW ---

// Show main menu at start
mainMenu.style.display = 'block';
difficultyMenu.style.display = 'none';
gameScreen.style.display = 'none';
leaderboardModal.style.display = 'none';

// Start game button
startBtn.onclick = () => {
    mainMenu.style.display = 'none';
    difficultyMenu.style.display = 'flex';
};

// Difficulty selection
difficultyBtns.forEach(btn => {
    btn.onclick = () => {
        currentDifficulty = btn.dataset.difficulty;
        difficultyMenu.style.display = 'none';
        gameScreen.style.display = 'block';
        startGame();
    };
});

// Close leaderboard button
closeLeaderboardBtn.onclick = () => {
    leaderboardModal.style.display = 'none';
    mainMenu.style.display = 'block';
};

// Home button: go back to main menu and stop the game
homeBtn.onclick = () => {
    // Hide game screen, show main menu
    gameScreen.style.display = 'none';
    mainMenu.style.display = 'block';
    leaderboardModal.style.display = 'none';
    // Stop Matter.js engine and renderer if running
    if (engine && render) {
        Render.stop(render);
        Engine.clear(engine);
        if (render.canvas && render.canvas.getContext) {
            render.canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    hideReloadTube();
};

// Reset button: restart the game state
resetBtn.onclick = () => {
    startGame();
};

// --- RELOAD TUBE LOGIC ---

// Show the reload tube above the slingshot
function showReloadTube(numDrops, slingshotX, slingshotY, scale = 1) {
    // Only show the reload tube if the game screen is visible
    if (gameScreen.style.display !== 'block') {
        if (reloadTube) {
            reloadTube.style.display = 'none';
        }
        return;
    }
    // Remove old tube if exists
    if (reloadTube) {
        reloadTube.remove();
    }
    reloadTube = document.createElement('div');
    reloadTube.id = 'reload-tube';
    reloadTube.style.display = 'block';

    // Scale tube height and offset
    const tubeHeight = Math.floor(320 * scale);
    const tubeTopOffset = Math.floor(340 * scale);

    // Position the tube above the slingshot (absolute, based on canvas position)
    const canvasRect = canvas.getBoundingClientRect();
    reloadTube.style.left = (canvasRect.left + slingshotX - Math.floor(18 * scale)) + 'px';
    reloadTube.style.top = (canvasRect.top + slingshotY - tubeTopOffset) + 'px';
    reloadTube.style.height = tubeHeight + 'px';
    reloadTube.style.width = Math.floor(36 * scale) + 'px';
    reloadTube.style.background = '#bbb';
    reloadTube.style.borderRadius = Math.floor(20 * scale) + 'px';
    reloadTube.style.border = '3px solid #888';
    reloadTube.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    reloadTube.style.position = 'absolute';

    // Add water drop image and count to the right of the tube
    reloadTube.innerHTML = '';
    if (numDrops > 0) {
        const dropIcon = document.createElement('img');
        dropIcon.src = 'img/water_drop.png';
        dropIcon.alt = 'Water Drop';
        dropIcon.style.width = Math.floor(28 * scale) + 'px';
        dropIcon.style.height = Math.floor(28 * scale) + 'px';
        dropIcon.style.verticalAlign = 'middle';
        dropIcon.style.marginLeft = Math.floor(10 * scale) + 'px';

        const dropCount = document.createElement('span');
        dropCount.textContent = `x${numDrops}`;
        dropCount.style.fontSize = (1.3 * scale) + 'em';
        dropCount.style.color = '#159A48';
        dropCount.style.fontWeight = 'bold';
        dropCount.style.marginLeft = Math.floor(6 * scale) + 'px';
        dropCount.style.verticalAlign = 'middle';

        const rightContainer = document.createElement('div');
        rightContainer.style.position = 'absolute';
        rightContainer.style.left = Math.floor(40 * scale) + 'px';
        rightContainer.style.top = Math.floor(10 * scale) + 'px';
        rightContainer.appendChild(dropIcon);
        rightContainer.appendChild(dropCount);

        reloadTube.appendChild(rightContainer);
    }

    reloadTubeContainer.appendChild(reloadTube);
}

// Hide the reload tube
function hideReloadTube() {
    if (reloadTube) {
        reloadTube.style.display = 'none';
    }
}

// Animate a water drop falling from the cylinder to the slingshot
function animateDropToSlingshot(callback, scale = 1) {
    // Create a DOM element for the animated drop
    const dropAnim = document.createElement('img');
    dropAnim.src = 'img/water_drop.png';
    dropAnim.alt = 'Water Drop';
    dropAnim.style.position = 'absolute';
    dropAnim.style.width = Math.floor(32 * scale) + 'px';
    dropAnim.style.height = Math.floor(32 * scale) + 'px';
    dropAnim.style.zIndex = '1000';
    dropAnim.style.pointerEvents = 'none';

    // Get start (top of cylinder) and end (slingshot) positions
    const canvasRect = canvas.getBoundingClientRect();
    const tubeTopOffset = Math.floor(340 * scale);
    const startX = canvasRect.left + slingshotPoint.x;
    const startY = canvasRect.top + slingshotPoint.y - tubeTopOffset + Math.floor(16 * scale);
    const endX = canvasRect.left + slingshotPoint.x - Math.floor(8 * scale);
    const endY = canvasRect.top + slingshotPoint.y - Math.floor(8 * scale);

    dropAnim.style.left = `${startX}px`;
    dropAnim.style.top = `${startY}px`;

    document.body.appendChild(dropAnim);

    // Animate using requestAnimationFrame
    const duration = 400; // ms
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Simple ease-in-out
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        dropAnim.style.left = `${startX + (endX - startX) * ease}px`;
        dropAnim.style.top = `${startY + (endY - startY) * ease}px`;
        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            document.body.removeChild(dropAnim);
            if (callback) callback();
        }
    }
    requestAnimationFrame(animate);
}

// --- GAME LOGIC ---

// Dynamically set canvas width to fill the window
function getCanvasWidth() {
    // Use the window's innerWidth for full width
    return window.innerWidth;
}
function getCanvasHeight() {
    // Keep the same aspect ratio as before (1200:600 = 2:1)
    return Math.floor(getCanvasWidth() / 2);
}

// Start or restart the game
function startGame() {
    score = 0;
    levelEnded = false;
    shotsLeft = DIFFICULTY_SETTINGS[currentDifficulty].shots;
    waterDropQueue = Array(shotsLeft - 1 >= 0 ? shotsLeft - 1 : 0).fill(true);
    launchedWaterDrops = [];
    updateScore();

    // Dynamically set canvas size
    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Calculate scale factor based on base size
    const scaleX = canvasWidth / BASE_WIDTH;
    const scaleY = canvasHeight / BASE_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    // Calculate new grass height
    const grassHeight = Math.floor(canvasHeight * GRASS_HEIGHT_RATIO);

    // Update slingshot and monster positions based on ratios
    slingshotPoint = {
        x: Math.floor(canvasWidth * SLINGSHOT_X_RATIO),
        y: Math.floor(canvasHeight * SLINGSHOT_Y_RATIO)
    };

    // Monster positions and sizes scale with canvas
    const monsterWidth = Math.floor(70 * scale);
    const monsterHeight = Math.floor(70 * scale);
    const monsterPositions = [
        { x: Math.floor(canvasWidth * MONSTER_X_RATIO), y: Math.floor(canvasHeight * MONSTER_Y_RATIO) },
        { x: Math.floor(canvasWidth * 0.7), y: Math.floor(canvasHeight * MONSTER_Y_RATIO) },
        { x: Math.floor(canvasWidth * 0.5), y: Math.floor(canvasHeight * MONSTER_Y_RATIO) }
    ];

    // Create Matter.js engine and world
    engine = Engine.create();
    world = engine.world;

    // Create renderer for our canvas
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: canvasWidth,
            height: canvasHeight,
            wireframes: false,
            background: '#e0f7fa'
        }
    });

    // Add ground (make it taller for more grass)
    const ground = Bodies.rectangle(
        canvasWidth / 2,
        canvasHeight - grassHeight / 2,
        canvasWidth,
        grassHeight,
        {
            isStatic: true,
            render: { fillStyle: '#4FCB53' }
        }
    );
    World.add(world, ground);

    // Add slingshot image as a static body (no collision)
    const slingImageWidth = Math.floor(80 * scale);
    const slingImageHeight = Math.floor(200 * scale);
    const slingBase = Bodies.rectangle(
        slingshotPoint.x,
        slingshotPoint.y + Math.floor(40 * scale),
        slingImageWidth,
        slingImageHeight,
        {
            isStatic: true,
            collisionFilter: { group: SLINGSHOT_GROUP },
            render: {
                sprite: {
                    texture: 'img/Slingshot.png',
                    xScale: slingImageWidth / 2594,
                    yScale: slingImageHeight / 6452
                }
            }
        }
    );
    World.add(world, slingBase);

    // Create monsters array for multiple monsters
    monsters = [];
    monsterPositions.forEach(pos => {
        const m = Bodies.rectangle(pos.x, pos.y, monsterWidth, monsterHeight, {
            label: 'monster',
            isStatic: false,
            render: {
                sprite: {
                    texture: 'img/trash_monster.png',
                    xScale: monsterWidth / 1024,
                    yScale: monsterHeight / 1024
                }
            }
        });
        monsters.push(m);
        World.add(world, m);
    });

    // --- Add rectangle obstacles for Medium and Hard difficulty ---
    if (currentDifficulty === 'medium' || currentDifficulty === 'hard') {
        const obstacle1 = Bodies.rectangle(
            Math.floor(canvasWidth * 0.6),
            Math.floor(canvasHeight * 0.6),
            Math.floor(120 * scale), Math.floor(24 * scale),
            {
                isStatic: true,
                render: { fillStyle: '#8BD1CB' }
            }
        );
        World.add(world, obstacle1);

        if (currentDifficulty === 'hard') {
            const obstacle2 = Bodies.rectangle(
                Math.floor(canvasWidth * 0.75),
                Math.floor(canvasHeight * 0.4),
                Math.floor(100 * scale), Math.floor(24 * scale),
                {
                    isStatic: true,
                    angle: Math.PI / 8,
                    render: { fillStyle: '#FF902A' }
                }
            );
            World.add(world, obstacle2);

            const obstacle3 = Bodies.rectangle(
                Math.floor(canvasWidth * 0.55),
                Math.floor(canvasHeight * 0.3),
                Math.floor(80 * scale), Math.floor(24 * scale),
                {
                    isStatic: true,
                    angle: -Math.PI / 10,
                    render: { fillStyle: '#F5402C' }
                }
            );
            World.add(world, obstacle3);
        }
    }

    // Show reload tube above slingshot (only drops left to reload)
    showReloadTube(waterDropQueue.length, slingshotPoint.x, slingshotPoint.y, scale);

    // Animate the first drop falling to the slingshot
    if (shotsLeft > 0) {
        animateDropToSlingshot(() => {
            createWaterDrop(scale);
        }, scale);
    }

    // Add mouse control for drag/release
    const mouse = Mouse.create(canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.02,
            render: { visible: false }
        }
    });
    World.add(world, mouseConstraint);

    // Track if the player is dragging the water drop
    let isDragging = false;
    let latestMousePos = { x: slingshotPoint.x, y: slingshotPoint.y };

    // Only allow dragging the water drop if it's at rest and not flying
    Events.on(mouseConstraint, 'startdrag', function(event) {
        if (event.body === waterDrop && !slingshotConstraint) {
            isDragging = true;
            // Attach a constraint (band) from slingshot to water drop
            slingshotConstraint = Constraint.create({
                pointA: slingshotPoint,
                bodyB: waterDrop,
                stiffness: 0.1,
                render: { visible: false }
            });
            World.add(world, slingshotConstraint);
        } else {
            mouseConstraint.constraint.bodyB = null;
        }
    });

    // Only update water drop position when dragging
    Events.on(mouseConstraint, 'mousemove', function(event) {
        if (isDragging && slingshotConstraint) {
            latestMousePos = mouse.position;
            moveWaterDropWithMouse(latestMousePos);
        }
    });

    // On mouse release inside canvas, launch if pulled back enough, else snap back
    Events.on(mouseConstraint, 'enddrag', function(event) {
        if (isDragging && slingshotConstraint) {
            endWaterDropDrag();
        }
    });

    // Only update water drop position when dragging (for mousemove outside canvas)
    window.addEventListener('mousemove', function(e) {
        if (isDragging && slingshotConstraint) {
            const rect = canvas.getBoundingClientRect();
            latestMousePos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            moveWaterDropWithMouse(latestMousePos);
        }
    });

    window.addEventListener('mouseup', function(e) {
        if (isDragging && slingshotConstraint) {
            endWaterDropDrag();
        }
    });

    // Draw a straight band only while dragging
    Events.on(render, 'afterRender', function() {
        if (isDragging && slingshotConstraint) {
            const ctx = render.context;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(slingshotPoint.x, slingshotPoint.y);
            ctx.lineTo(waterDrop.position.x, waterDrop.position.y);
            ctx.strokeStyle = '#FFC907';
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
        }
    });

    // Add gliding effect after launch
    Events.on(engine, 'beforeUpdate', function() {
        if (!waterDrop.isStatic && !isDragging) {
            Matter.Body.applyForce(waterDrop, waterDrop.position, { x: 0.00015, y: 0 });
        }
    });

    // Collision event: water drop hits monster
    Events.on(engine, 'collisionStart', function(event) {
        event.pairs.forEach(pair => {
            // Check collision for all launched water drops and the current one
            let hitMonsterIndex = -1;
            // Check current waterDrop
            monsters.forEach((m, idx) => {
                if (
                    (pair.bodyA === waterDrop && pair.bodyB === m) ||
                    (pair.bodyB === waterDrop && pair.bodyA === m)
                ) {
                    hitMonsterIndex = idx;
                }
            });
            // Check all launched water drops
            for (let i = 0; i < launchedWaterDrops.length; i++) {
                monsters.forEach((m, idx) => {
                    if (
                        (pair.bodyA === launchedWaterDrops[i] && pair.bodyB === m) ||
                        (pair.bodyB === launchedWaterDrops[i] && pair.bodyA === m)
                    ) {
                        hitMonsterIndex = idx;
                    }
                });
            }
            // If a monster was hit, remove it
            if (hitMonsterIndex !== -1 && monsters[hitMonsterIndex]) {
                World.remove(world, monsters[hitMonsterIndex]);
                monsters.splice(hitMonsterIndex, 1);
                score += 200;
                updateScore();
                // If all monsters are gone, win
                if (monsters.length === 0) {
                    endLevel(true); // true = win
                }
            }
        });
    });

    // Run the engine and renderer
    Engine.run(engine);
    Render.run(render);

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

// Create a new water drop at the slingshot
function createWaterDrop(scale = 1) {
    // Only remove the old water drop if it is still static (not flying)
    if (waterDrop && waterDrop.isStatic) {
        World.remove(world, waterDrop);
    }
    // Only create if there are drops left (including the current one)
    if (waterDropQueue.length < 0) return;
    const dropRadius = Math.floor(24 * scale);
    waterDrop = Bodies.circle(slingshotPoint.x, slingshotPoint.y, dropRadius, {
        density: 0.004,
        restitution: 0.7,
        label: 'waterDrop',
        isStatic: true,
        collisionFilter: { group: SLINGSHOT_GROUP },
        render: {
            sprite: {
                texture: 'img/water_drop.png',
                xScale: (dropRadius * 2) / 1024,
                yScale: (dropRadius * 2) / 1024
            }
        }
    });
    World.add(world, waterDrop);
    // Do NOT add the constraint here! Only add it when dragging.
}

// Update score display
function updateScore() {
    scoreSpan.textContent = `Score: ${score}`;
}

// Add win/lose popup element to the DOM if not present
let resultPopup = document.getElementById('result-popup');
let resultPopupMsg;
let showLeaderboardAfterPopup = false; // Track if leaderboard should show after popup
if (!resultPopup) {
    resultPopup = document.createElement('div');
    resultPopup.id = 'result-popup';
    resultPopup.style.display = 'none';
    resultPopup.style.position = 'fixed';
    resultPopup.style.left = '50%';
    resultPopup.style.top = '40%';
    resultPopup.style.transform = 'translate(-50%, -50%)';
    resultPopup.style.background = '#fff';
    resultPopup.style.border = '3px solid #FFC907';
    resultPopup.style.borderRadius = '16px';
    resultPopup.style.padding = '40px 32px';
    resultPopup.style.fontSize = '2em';
    resultPopup.style.color = '#159A48';
    resultPopup.style.zIndex = '9999';
    resultPopup.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
    resultPopup.style.fontWeight = 'bold';
    resultPopup.style.textAlign = 'center';
    // Add a text node for the message
    resultPopupMsg = document.createElement('div');
    resultPopupMsg.id = 'result-popup-msg';
    resultPopupMsg.style.marginBottom = '18px';
    resultPopup.appendChild(resultPopupMsg);
    // Add a close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'OK';
    closeBtn.style.marginTop = '24px';
    closeBtn.style.fontSize = '1em';
    closeBtn.style.background = '#FFC907';
    closeBtn.style.color = '#159A48';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.padding = '10px 28px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => {
        resultPopup.style.display = 'none';
        mainMenu.style.display = 'block';
        hideReloadTube();
        // Show leaderboard if flagged
        if (showLeaderboardAfterPopup) {
            showLeaderboardAfterPopup = false;
            showLeaderboard();
        }
    };
    resultPopup.appendChild(closeBtn);
    document.body.appendChild(resultPopup);
} else {
    resultPopupMsg = document.getElementById('result-popup-msg');
}

// Helper to show the popup
function showResultPopup(message, showLeaderboardNext) {
    resultPopupMsg.textContent = message;
    resultPopup.style.display = 'block';
    gameScreen.style.display = 'none';
    leaderboardModal.style.display = 'none';
    mainMenu.style.display = 'none';
    hideReloadTube();
    // Set flag if leaderboard should show after popup
    showLeaderboardAfterPopup = !!showLeaderboardNext;
}

// Helper to hide the popup
function hideResultPopup() {
    resultPopup.style.display = 'none';
}

// End level and show leaderboard
function endLevel(win) {
    if (levelEnded) return;
    levelEnded = true;
    hideReloadTube();

    setTimeout(() => {
        Render.stop(render);
        Engine.clear(engine);
        render.canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        saveScore(score);
        // Pass true to showLeaderboardNext so leaderboard pops up after OK
        if (win) {
            showResultPopup('You Win :D', true);
        } else {
            showResultPopup('You Lose :[', true);
        }
        // (No setTimeout for showLeaderboard here)
    }, 400);
}

// Save score to localStorage leaderboard
function saveScore(newScore) {
    let scores = JSON.parse(localStorage.getItem('washedAwayLeaderboard')) || [];
    scores.push(newScore);
    scores.sort((a, b) => b - a);
    scores = scores.slice(0, 5);
    localStorage.setItem('washedAwayLeaderboard', JSON.stringify(scores));
}

// Show leaderboard modal
function showLeaderboard() {
    let scores = JSON.parse(localStorage.getItem('washedAwayLeaderboard')) || [];
    leaderboardList.innerHTML = '';
    scores.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `#${i + 1}: ${s} pts`;
        leaderboardList.appendChild(li);
    });
    leaderboardModal.style.display = 'block';
    gameScreen.style.display = 'none';
}

// Add a footer with a donation link for Charity: Water
function addCharityFooter() {
    // Check if footer already exists
    if (document.getElementById('charity-footer')) return;

    // Create footer element
    const footer = document.createElement('footer');
    footer.id = 'charity-footer';
    footer.style.position = 'fixed';
    footer.style.left = '0';
    footer.style.right = '0';
    footer.style.bottom = '0';
    footer.style.background = '#FFC907';
    footer.style.color = '#159A48';
    footer.style.textAlign = 'center';
    footer.style.padding = '18px 0 14px 0';
    footer.style.fontSize = '1.1em';
    footer.style.fontWeight = 'bold';
    footer.style.zIndex = '99999';
    footer.style.letterSpacing = '0.5px';

    // Create link
    const link = document.createElement('a');
    link.href = 'https://www.charitywater.org/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.color = '#159A48';
    link.style.textDecoration = 'underline';
    link.style.fontWeight = 'bold';
    link.textContent = 'Donate to Charity: Water';

    // Add text and link to footer
    footer.appendChild(document.createTextNode('Support clean water for all! '));
    footer.appendChild(link);

    // Add footer to body
    document.body.appendChild(footer);
}

// Call this once when the script loads
addCharityFooter();

// Helper function to move the water drop with the mouse, clamped to the slingshot
function moveWaterDropWithMouse(mousePos) {
    const dx = mousePos.x - slingshotPoint.x;
    const dy = mousePos.y - slingshotPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let newX = mousePos.x;
    let newY = mousePos.y;
    // Clamp to max pull-back distance
    if (dist > maxPullDistance) {
        const angle = Math.atan2(dy, dx);
        newX = slingshotPoint.x + Math.cos(angle) * maxPullDistance;
        newY = slingshotPoint.y + Math.sin(angle) * maxPullDistance;
    }
    // Only allow pulling to the left of the slingshot
    if (newX > slingshotPoint.x) {
        newX = slingshotPoint.x;
    }
    Matter.Body.setPosition(waterDrop, { x: newX, y: newY });
    Matter.Body.setVelocity(waterDrop, { x: 0, y: 0 });
}

// Helper function to end drag and launch or snap back
function endWaterDropDrag() {
    // Calculate pull-back vector
    const dx = slingshotPoint.x - waterDrop.position.x;
    const dy = slingshotPoint.y - waterDrop.position.y;
    const pullDistance = Math.sqrt(dx * dx + dy * dy);

    if (pullDistance > 10) {
        // Remove the constraint (band)
        World.remove(world, slingshotConstraint);
        slingshotConstraint = null;
        // Make the water drop dynamic so it can fly
        Matter.Body.setStatic(waterDrop, false);
        // Lower air friction for more gliding
        waterDrop.frictionAir = 0.005;
        // Apply a stronger force for a bigger launch (increased for larger canvas)
        const forceScale = 0.004;
        Matter.Body.applyForce(
            waterDrop,
            waterDrop.position,
            {
                x: dx * forceScale,
                y: dy * forceScale
            }
        );
        shotsLeft--;
        launchedWaterDrops.push(waterDrop);
        if (waterDropQueue.length > 0) {
            waterDropQueue.pop();
        }
        showReloadTube(waterDropQueue.length, slingshotPoint.x, slingshotPoint.y);

        // Animate the next drop falling if any left
        setTimeout(() => {
            if (shotsLeft > 0 && !levelEnded) {
                animateDropToSlingshot(() => {
                    createWaterDrop();
                });
            }
            // If no shots left and monsters are still alive, trigger lose
            if (shotsLeft === 0 && !levelEnded && monsters.length > 0) {
                endLevel(false); // false = lose
            }
        }, 600);
    } else {
        // Not pulled enough: snap back and make static again
        Matter.Body.setPosition(waterDrop, { x: slingshotPoint.x, y: slingshotPoint.y });
        Matter.Body.setVelocity(waterDrop, { x: 0, y: 0 });
        Matter.Body.setStatic(waterDrop, true);
        World.remove(world, slingshotConstraint);
        slingshotConstraint = null;
    }
    isDragging = false;
}

// Optional: Update canvas size on window resize and restart game for demo/testing
window.addEventListener('resize', () => {
    if (gameScreen.style.display === 'block') {
        startGame();
    }
});
