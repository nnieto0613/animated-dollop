// Beginner-friendly Washed Away game base using Matter.js and DOM

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

// Game state variables
let score = 0;
let shotsLeft = 3; // For demo, 3 shots per level
let levelEnded = false;

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
let monster;

// These ratios keep the slingshot and monster at the same relative positions
const SLINGSHOT_X_RATIO = 220 / 1200;
// We'll set the slingshot and monster to sit on top of the new, taller grass layer
const GRASS_HEIGHT_RATIO = 0.18; // 18% of canvas height for grass
const SLINGSHOT_Y_RATIO = (1 - GRASS_HEIGHT_RATIO) - (100 / 600); // 100px above new grass for slingshot center
const MONSTER_X_RATIO = 950 / 1200;
const MONSTER_Y_RATIO = (1 - GRASS_HEIGHT_RATIO) - (35 / 600); // 35px above new grass for monster center

let slingshotPoint = { x: 0, y: 0 };
const maxPullDistance = 120; // Keep the same pull-back

// Use a negative collision group for slingshot and water drop so they never collide
const SLINGSHOT_GROUP = -2;

// Show main menu at start
mainMenu.style.display = 'block';
gameScreen.style.display = 'none';
leaderboardModal.style.display = 'none';

// Start game button
startBtn.onclick = () => {
    mainMenu.style.display = 'none';
    gameScreen.style.display = 'block';
    startGame();
};

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
};

// Reset button: restart the game state
resetBtn.onclick = () => {
    // Just call startGame to reset everything
    startGame();
};

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
    shotsLeft = 3;
    levelEnded = false;
    updateScore();

    // Dynamically set canvas size
    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Calculate new grass height
    const grassHeight = Math.floor(canvasHeight * GRASS_HEIGHT_RATIO);

    // Update slingshot and monster positions based on ratios
    slingshotPoint = {
        x: Math.floor(canvasWidth * SLINGSHOT_X_RATIO),
        y: Math.floor(canvasHeight * SLINGSHOT_Y_RATIO)
    };
    const monsterX = Math.floor(canvasWidth * MONSTER_X_RATIO);
    const monsterY = Math.floor(canvasHeight * MONSTER_Y_RATIO);

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

    // Add slingshot "Y" arms (replace with image)
    // Remove the old leftArm and rightArm code

    // Add slingshot image as a static body (no collision)
    // The original image is 2594x6452, so we want a tall but not too wide slingshot
    // We'll scale it to about 80px wide and 200px tall on the canvas
    const slingImageWidth = 80;
    const slingImageHeight = 200;
    const slingBase = Bodies.rectangle(
        slingshotPoint.x,
        slingshotPoint.y + 40,
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

    // Add monster (dummy target) with image
    // The original image is 1024x1024, we'll scale it to 70x70
    const monsterWidth = 70;
    const monsterHeight = 70;
    monster = Bodies.rectangle(monsterX, monsterY, monsterWidth, monsterHeight, {
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
    World.add(world, monster);

    // Add water drop (player projectile)
    createWaterDrop();

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

    // Only update water drop position when dragging
    window.addEventListener('mousemove', function(e) {
        // Only move the water drop if we are dragging AND the slingshot band exists
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
        // Only end drag if we are dragging AND the slingshot band exists
        if (isDragging && slingshotConstraint) {
            endWaterDropDrag();
        }
    });

    // Track if the player is dragging the water drop
    let isDragging = false;

    // Store the latest mouse position globally for gliding/dragging
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
        // If the water drop is flying (not static and not being dragged)
        if (!waterDrop.isStatic && !isDragging) {
            // Apply a small rightward force to simulate gliding
            Matter.Body.applyForce(waterDrop, waterDrop.position, { x: 0.00015, y: 0 });
        }
    });

    // Collision event: water drop hits monster
    Events.on(engine, 'collisionStart', function(event) {
        event.pairs.forEach(pair => {
            if (
                (pair.bodyA === waterDrop && pair.bodyB === monster) ||
                (pair.bodyB === waterDrop && pair.bodyA === monster)
            ) {
                World.remove(world, monster);
                score += 200;
                updateScore();
                endLevel();
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
function createWaterDrop() {
    // Remove old water drop if exists
    if (waterDrop) {
        World.remove(world, waterDrop);
    }
    // Use image for water drop
    // The original image is 1024x1024, we'll scale it to 48x48
    const dropRadius = 24;
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

// End level and show leaderboard
function endLevel() {
    if (levelEnded) return;
    levelEnded = true;

    // Stop Matter.js engine and renderer
    setTimeout(() => {
        Render.stop(render);
        Engine.clear(engine);
        render.canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        // Save score to leaderboard
        saveScore(score);

        // Show leaderboard
        showLeaderboard();
    }, 1000);
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
    // Get scores from localStorage
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
        const forceScale = 0.004; // was 0.0025, now stronger
        Matter.Body.applyForce(
            waterDrop,
            waterDrop.position,
            {
                x: dx * forceScale,
                y: dy * forceScale
            }
        );
        shotsLeft--;
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
    // Only resize if game is running
    if (gameScreen.style.display === 'block') {
        startGame();
    }
});
