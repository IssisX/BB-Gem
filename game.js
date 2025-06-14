import { PhysicsEngine } from './physics.js';
import { ControlsManager } from './controls.js';

// ECS Core
const Entity = require('./src/Entity');
const EntityManager = require('./src/EntityManager');

// Components
const PositionComponent = require('./src/components/PositionComponent');
const VelocityComponent = require('./src/components/VelocityComponent');
const RenderComponent = require('./src/components/RenderComponent');
const PhysicsComponent = require('./src/components/PhysicsComponent');
const PlayerControlledComponent = require('./src/components/PlayerControlledComponent');
const AIControlledComponent = require('./src/components/AIControlledComponent');
const HealthComponent = require('./src/components/HealthComponent');
const EnergyComponent = require('./src/components/EnergyComponent');
const WeaponComponent = require('./src/components/WeaponComponent');

// Systems
const PhysicsSystem = require('./src/systems/PhysicsSystem');
const RenderSystem = require('./src/systems/RenderSystem');
const PlayerInputSystem = require('./src/systems/PlayerInputSystem');
const AISystem = require('./src/systems/AISystem');
const CollisionSystem = require('./src/systems/CollisionSystem');
const EnergySystem = require('./src/systems/EnergySystem');
const HealthSystem = require('./src/systems/HealthSystem');
const ParticleSystem = require('./src/systems/ParticleSystem');
const EffectSystem = require('./src/systems/EffectSystem');
const AnimationSystem = require('./src/systems/AnimationSystem'); // Import AnimationSystem
const AnimationComponent = require('./src/components/AnimationComponent'); // Import AnimationComponent for bot creation

export class GameEngine {
    constructor(canvas, options, dataManager) { // Added dataManager
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;
        this.dataManager = dataManager; // Store DataManager instance
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.gameTime = 0;
        this.maxGameTime = 120000; // 2 minutes
        
        this.physics = null; // PhysicsEngine instance
        this.controls = null;
        this.camera = {
            targetX: 0, // Logical target X (e.g., player position)
            targetY: 0, // Logical target Y
            currentX: 0, // Actual render X (includes shake)
            currentY: 0, // Actual render Y (includes shake)
            zoom: 1,
            target: null, // Target entity

            // Shake properties
            shakeIntensity: 0,
            shakeDuration: 0,
            currentShakeTime: 0
        };
        
        this.entityManager = new EntityManager();
        this.systems = [];
        this.systemUpdateOrder = [];

        // Game Feel properties
        this.isSlowMotion = false;
        this.slowMotionFactor = 0.5; // Default factor
        this.slowMotionDuration = 0;
        this.currentSlowMotionTime = 0;

        this.isHitStop = false;
        this.hitStopDuration = 0;
        this.currentHitStopTime = 0;

        // Game state message properties
        this.countdownMessage = "";
        this.countdownTimer = 0; // Not used in current setInterval approach, but could be for deltaTime based
        this.postGameMessage = "";
        this.showingPostGameMessage = false;
        this.playerInputDisabled = false; // To disable input during countdown

        this.gameStats = {
            damage: 0,
            hits: 0,
            shots: 0,
            startTime: 0
        };
        
        this.eventListeners = {};
        
        this.init();
    }

    async init() {
        this.setupCanvas();
        
        this.physics = new PhysicsEngine(this.options); // Assuming PhysicsEngine constructor doesn't take options in the simplified version
        this.controls = new ControlsManager(this, this.options);

        // Initialize Systems
        const effectSystem = new EffectSystem(this.entityManager);
        const particleSystem = new ParticleSystem(this.entityManager, { particleQuality: this.options.quality }, effectSystem);
        const animationSystem = new AnimationSystem(this.entityManager); // Instantiate AnimationSystem
        const renderSystem = new RenderSystem(this.ctx, this.entityManager, this.camera, this);

        this.systems.push(new PlayerInputSystem(this.controls));
        this.systems.push(new AISystem(this.entityManager));
        this.systems.push(new PhysicsSystem(this.physics, this.entityManager));
        this.systems.push(new CollisionSystem(this.physics, this.entityManager, particleSystem, effectSystem));
        this.systems.push(new EnergySystem());
        this.systems.push(new HealthSystem(this.entityManager, particleSystem, effectSystem));
        this.systems.push(particleSystem);
        this.systems.push(effectSystem);
        this.systems.push(animationSystem); // Add AnimationSystem to the list
        this.systems.push(renderSystem);

        this.systemUpdateOrder = [
            PlayerInputSystem,
            AISystem,
            EnergySystem,
            PhysicsSystem,
            CollisionSystem,
            HealthSystem,
            ParticleSystem,
            EffectSystem,
            AnimationSystem, // Add AnimationSystem to update order (before RenderSystem)
            RenderSystem,
        ].map(SystemClass => this.systems.find(s => s instanceof SystemClass)).filter(s => s);

        // Event listeners from physics engine
        this.physics.on('botHit', this.handleBotHit.bind(this));
        this.physics.on('projectileHitWall', this.handleProjectileHitWall.bind(this));

        // Load a default level or wait for app.js to call loadLevel
        this.currentMapData = null; // To store loaded map data
        this.loadLevel('arena_basic_v1', 'player_starter_balanced', 'enemy_grunt_blaster_v1');
        
        this.setupEventListeners();
        
        console.log('Game engine initialized, level loading initiated.');
    }

    loadLevel(mapId, playerBotConfigId, enemyBotConfigId) {
        if (!this.dataManager) {
            console.error("DataManager not available to load level.");
            return;
        }
        this.currentMapData = this.dataManager.getMapDataById(mapId);
        if (!this.currentMapData) {
            console.error(`Map data for ${mapId} not found.`);
            return;
        }

        // TODO: Clear existing entities (obstacles, previous bots) from EntityManager and PhysicsEngine
        this.entityManager.getAllEntities().forEach(entity => {
            const physicsComp = entity.getComponent(PhysicsComponent);
            if (physicsComp && physicsComp.body) {
                this.physics.world.removeBody(physicsComp.body);
            }
            this.entityManager.removeEntity(entity.id);
        });


        // Update RenderSystem with new background info (if RenderSystem supports it)
        const renderSys = this.systems.find(s => s instanceof RenderSystem);
        if (renderSys && typeof renderSys.setMapBackground === 'function') {
            renderSys.setMapBackground(this.currentMapData.background);
        } else if (renderSys) { // Fallback for existing drawArenaBackground
            renderSys.mapDimensions = this.currentMapData.dimensions; // Pass dimensions
        }


        // Create obstacles from map data
        if (this.currentMapData.obstacles) {
            this.currentMapData.obstacles.forEach(obsData => {
                this.createObstacle(obsData);
            });
        }

        // Create player and enemy bots using configurations and start positions
        const playerConfig = this.dataManager.getBotConfigById(playerBotConfigId);
        const enemyConfig = this.dataManager.getBotConfigById(enemyBotConfigId);

        if (playerConfig && this.currentMapData.playerStartPositions[0]) {
            this.createPlayerBot(playerConfig, this.currentMapData.playerStartPositions[0]);
        } else {
            console.error("Player config or start position not found for level setup.");
        }

        if (enemyConfig && this.currentMapData.playerStartPositions[1]) {
            this.createEnemyBot(enemyConfig, this.currentMapData.playerStartPositions[1]);
        } else {
            console.error("Enemy config or start position not found for level setup.");
        }
        console.log(`Level ${mapId} loaded with bots.`);
    }

    createObstacle(obstacleData) {
        const entity = this.entityManager.createEntity(obstacleData.id || `obstacle_${Math.random().toString(36).substr(2, 9)}`);
        entity.addComponent(new PositionComponent(obstacleData.x, obstacleData.y));

        const renderInfo = obstacleData.render || {};
        entity.addComponent(new RenderComponent(
            renderInfo.shape || 'rectangle',
            renderInfo.color || '#777777',
            renderInfo.sprite,
            true,
            0, // zOrder for obstacles
            renderInfo.size || obstacleData.width // Use width as default size if not specified
        ));

        const physicsInfo = obstacleData.physics || {};
        const bodyOptions = {
            mass: physicsInfo.isStatic === false ? (physicsInfo.mass || 50) : 0, // Static if mass is 0
            position: new CANNON.Vec3(obstacleData.x, obstacleData.z !== undefined ? obstacleData.z : (obstacleData.height || 50)/2, obstacleData.y), // Game Y to Physics Z
            fixedRotation: true, // Most obstacles probably don't rotate wildly
            linearDamping: 0.3, // Some damping
            angularDamping: 0.9, // High angular damping for obstacles
            material: this.physics.materials.wallMaterial // Default material for obstacles
        };

        let shape;
        const shapeType = physicsInfo.shape || (obstacleData.radius ? 'sphere' : 'box');
        if (shapeType === 'sphere') {
            shape = new CANNON.Sphere(obstacleData.radius);
        } else { // Default to box
            shape = new CANNON.Box(new CANNON.Vec3(
                (obstacleData.width || 50) / 2,
                (obstacleData.depth || obstacleData.width || 50) / 2, // Assuming depth = width if not specified for physics body
                (obstacleData.height || 50) / 2  // Game height is physics Z extent
            ));
             // Cannon.js Y is up, so height for physics body is different from visual height if top-down
             // For a top-down game, the visual "height" of an obstacle might be its Z-extent in physics.
             // Let's assume depth for physics is visual height for now.
             // And physics height (Y) is some arbitrary value or half of visual height if origin is at base.
             // This needs careful alignment with how physics world is set up.
             // For now, using obstacleData.height as the vertical extent (Cannon's Y).
             bodyOptions.position.y = (obstacleData.height || 50) / 2; // Center of mass vertically
             shape = new CANNON.Box(new CANNON.Vec3( (obstacleData.width || 50)/2, (obstacleData.height || 50)/2, (obstacleData.depth || 50)/2 ));

        }

        const body = new CANNON.Body(bodyOptions);
        body.addShape(shape);
        if (obstacleData.rotation) {
            body.quaternion.setFromEuler(0, obstacleData.rotation, 0); // Assuming Y-up rotation for map objects
        }
        body.userData = { entityId: entity.id, type: 'obstacle' };
        this.physics.world.addBody(body);

        entity.addComponent(new PhysicsComponent(body, {
            mass: bodyOptions.mass,
            size: { width: obstacleData.width, height: obstacleData.height, depth: obstacleData.depth, radius: obstacleData.radius },
            linearDamping: bodyOptions.linearDamping,
            angularDamping: bodyOptions.angularDamping,
            friction: physicsInfo.friction,
            restitution: physicsInfo.restitution
        }));
    }


    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.imageSmoothingEnabled = this.options.quality !== 'low';
    }

    setupEventListeners() {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
        this.on('swipeDown', () => this.togglePause());
        this.on('swipeUp', () => {
            // This should be handled by PlayerInputSystem listening for an event or checking a control state
            // For now, we can try to find the player entity and set a component or call a method.
            const playerEntity = this.entityManager.getEntityById('player');
            if(playerEntity && playerEntity.hasComponent(PlayerControlledComponent)) {
                // Example: playerEntity.addComponent(new ActivateSpecialAbilityComponent());
                // Or PlayerInputSystem checks for this gesture and sets velocity/state on PhysicsComponent/WeaponComponent
                console.log("Swipe up detected for player special ability - system should handle this.");
                // this.activateSpecialAbility(); // Old direct call
            }
        });
    }

    createBotEntity(entityId, botConfig, initialPos, isPlayer = false) {
        if (!this.dataManager) {
            console.error("DataManager not available in GameEngine. Cannot create bot.");
            return null;
        }

        const chassisData = this.dataManager.getPartById(botConfig.chassisId);
        const armorData = botConfig.armorId ? this.dataManager.getPartById(botConfig.armorId) : null;
        // Assuming one weapon for now, can be extended to multiple
        const weaponData = botConfig.weaponIds && botConfig.weaponIds.length > 0
                           ? this.dataManager.getPartById(botConfig.weaponIds[0])
                           : null;

        if (!chassisData) {
            console.error(`Chassis with ID ${botConfig.chassisId} not found. Cannot create bot ${entityId}.`);
            return null;
        }
        if (!weaponData) {
            console.warn(`Weapon for bot ${entityId} not found. Proceeding without weapon.`);
        }

        const entity = this.entityManager.createEntity(entityId);

        // Calculate combined stats
        let totalHealth = chassisData.stats.baseHealth;
        let totalMass = chassisData.stats.mass;
        if (armorData && armorData.stats.addedHealth) totalHealth += armorData.stats.addedHealth;
        if (armorData && armorData.stats.addedMass) totalMass += armorData.stats.addedMass;
        
        const physicsOptions = {
            mass: totalMass,
            size: chassisData.stats.size || { width: 60, height: 80, depth: 60, radius: 30 }, // Default size if not in chassis
            accelerationForce: chassisData.stats.accelerationForce,
            maxSpeed: chassisData.stats.maxSpeed,
            linearDamping: chassisData.stats.linearDamping,
            angularDamping: chassisData.stats.angularDamping,
            friction: chassisData.stats.friction || 0.2,
            restitution: chassisData.stats.restitution || 0.1
        };
        
        const botBody = this.physics.createBot(entityId, initialPos.x, initialPos.y, {
            width: physicsOptions.size.width,
            height: physicsOptions.size.height,
            mass: physicsOptions.mass,
            // Pass other physics relevant options if createBot uses them (like maxSpeed, acceleration from chassisData.stats for userData)
            maxSpeed: chassisData.stats.maxSpeed,
            acceleration: chassisData.stats.accelerationForce, // Note: physics.createBot might use 'acceleration' not 'accelerationForce'
            linearDamping: physicsOptions.linearDamping,
            angularDamping: physicsOptions.angularDamping
        });
        botBody.userData.entityId = entityId;

        entity.addComponent(new PositionComponent(initialPos.x, initialPos.y))
              .addComponent(new VelocityComponent())
              .addComponent(new PhysicsComponent(botBody, physicsOptions));

        // Setup RenderComponent with layers
        const renderComp = new RenderComponent(
            chassisData.renderShape || 'bot', // Fallback shape if no sprites/layers
            isPlayer ? '#00ffff' : '#ff0040', // Base color for the bot entity
            chassisData.sprite,               // Main sprite (chassis)
            true,                             // isVisible
            1,                                // zOrder
            chassisData.stats.renderSize || 30 // Base size
        );

        // Add chassis as the first layer
        renderComp.layers.push({
            partType: 'chassis',
            sprite: chassisData.sprite,
            offsetX: 0, offsetY: 0, rotation: 0,
            zOrderOffset: 0, // Base layer for chassis
            width: chassisData.stats.renderSize || 60, // Use specific or default sizes
            height: chassisData.stats.renderSize || (chassisData.stats.size?.height || 60)
        });

        // Add weapon layers (assuming one weapon for now)
        if (weaponData && weaponData.sprite) {
            const weaponAttachPoint = chassisData.attachmentPoints?.weaponSlot1 || {x:0, y:0, defaultRotation:0};
            renderComp.layers.push({
                partType: 'weapon',
                sprite: weaponData.sprite,
                offsetX: weaponAttachPoint.x,
                offsetY: weaponAttachPoint.y,
                rotation: weaponAttachPoint.defaultRotation || 0,
                zOrderOffset: 1, // Weapon on top of chassis
                width: weaponData.render?.width || weaponData.stats.projectileSize * 2 || 20, // Estimate size
                height: weaponData.render?.height || weaponData.stats.projectileSize * 4 || 40,
                // color: weaponData.render?.color // Optional: if weapon part itself has a tint on its sprite
            });
        }
        
        // TODO: Add armor layers if they have visual sprites

        entity.addComponent(renderComp);
        entity.addComponent(new HealthComponent(totalHealth))
              .addComponent(new EnergyComponent(chassisData.stats.baseEnergy, chassisData.stats.energyRegenRate || 10));

        if (isPlayer) {
            entity.addComponent(new PlayerControlledComponent());
        } else {
            entity.addComponent(new AIControlledComponent('seeking', null));
        }

        if (weaponData) {
            entity.addComponent(new WeaponComponent(
                weaponData.stats.fireRate,
                weaponData.stats.projectileType || weaponData.render.shape, // Use render shape as fallback
                weaponData.stats.projectileSpeed,
                weaponData.stats.damage,
                weaponData.stats.projectileSize,
                weaponData.stats.projectileColor,
                weaponData.stats.projectileLifetime * 1000,
                weaponData.stats.energyCost,
                weaponData.stats.spread,
                weaponData.render // Pass the render object from JSON
            ));
        }

        entity.addComponent(new AnimationComponent({
            'fireRecoil': {
                targetProperties: { renderOffsetY: - (chassisData.stats.renderSize || 30) * 0.2, animationScale: 0.95 },
                duration: 0.075,
                easingFunction: 'easeOutQuad',
                resetsToOriginal: true
            },
            'hitReact': {
                targetProperties: { animationTintColor: 'rgba(255,100,100,0.6)' },
                duration: 0.15,
                easingFunction: 'linear',
                resetsToOriginal: true
            }
        }));

        return entity;
    }

    createPlayerBot(botConfig, startPosition) {
        const playerEntity = this.createBotEntity('player', botConfig, startPosition || {x: -100, y: 0}, true);
        if (playerEntity) {
            this.camera.target = playerEntity;
            // Set initial camera position to player start
            this.camera.targetX = playerEntity.getComponent(PositionComponent).x;
            this.camera.targetY = playerEntity.getComponent(PositionComponent).y;
            this.camera.currentX = this.camera.targetX;
            this.camera.currentY = this.camera.targetY;
        }
    }

    createEnemyBot(botConfig, startPosition) {
        this.createBotEntity('enemy', botConfig, startPosition || {x: 100, y: 0}, false);
    }

    start() {
                            duration: 0.1,
                            easingFunction: 'easeOutQuad',
                            resetsToOriginal: true
                        },
                        'hitReact': {
                            targetProperties: { animationTintColor: 'rgba(255,100,100,0.6)' },
                            duration: 0.15,
                            easingFunction: 'linear',
                            resetsToOriginal: true
                        }
                   }));
    }

    start() {
        this.isRunning = true; // Game loop will start processing updates
        this.isPaused = false; // Ensure not paused
        this.gameTime = 0;
        this.gameStats.startTime = Date.now();
        
        this.startMatchCountdown(); // Initiate countdown before regular game loop takes full effect for gameplay
        
        // gameLoop is already started by App.js typically, or should be if this is the main entry.
        // if(!this.gameLoopRequestId) this.gameLoop();

        this.updateGameTimer();
        
        // console.log('Game started sequence initiated'); // More accurate log
    }

    startMatchCountdown() {
        this.playerInputDisabled = true; // Disable player input
        // PlayerInputSystem should check this flag or be disabled via another mechanism
        const messages = ['3', '2', '1', 'FIGHT!'];
        let currentMessageIndex = 0;
        this.countdownMessage = messages[currentMessageIndex];

        const countdownInterval = setInterval(() => {
            currentMessageIndex++;
            if (currentMessageIndex < messages.length) {
                this.countdownMessage = messages[currentMessageIndex];
            } else {
                clearInterval(countdownInterval);
                this.countdownMessage = ""; // Clear message
                this.playerInputDisabled = false; // Enable player input
                console.log('FIGHT!');
                // Actual game logic (like AI starting, etc.) effectively begins now as systems update.
            }
        }, 1000); // Display each message for 1 second
    }


    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;
        
        const actualDeltaTime = (currentTime - this.lastTime) / 1000; // Actual time elapsed
        this.lastTime = currentTime;
        let currentDeltaTime = actualDeltaTime;

        // Handle Hit Stop
        if (this.isHitStop) {
            this.currentHitStopTime -= actualDeltaTime;
            if (this.currentHitStopTime <= 0) {
                this.isHitStop = false;
            }
            // Effectively pause most updates by returning early or using a minimal deltaTime
            // For a more pronounced effect, we might only update specific animations or nothing.
            // Here, we pass a very small deltaTime or skip certain system updates.
            // For simplicity, let's make deltaTime effectively zero for hit stop.
            currentDeltaTime = 0.00001; // Or just return and skip updates for true freeze
            if (this.isHitStop) { // Re-check as it might have been turned off
                 requestAnimationFrame(this.gameLoop.bind(this)); // Keep the loop going
                 // To truly pause, you might want to skip system updates entirely for some frames
                 // For now, a tiny deltaTime will slow things dramatically.
            }
        }

        // Handle Slow Motion
        if (this.isSlowMotion && !this.isHitStop) { // Don't compound with hit stop's own time effect
            currentDeltaTime *= this.slowMotionFactor;
            this.currentSlowMotionTime -= actualDeltaTime; // Deplete duration with actual time
            if (this.currentSlowMotionTime <= 0) {
                this.isSlowMotion = false;
            }
        }
        
        if (!this.isPaused) {
            this.update(currentDeltaTime); // Main ECS update with potentially modified deltaTime
            
            this.gameTime += actualDeltaTime * 1000; // Game time progresses normally
            this.checkGameEnd();
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    triggerSlowMotion(factor = 0.5, duration = 1000) { // factor (0.1-1.0), duration in ms
        if (this.options.quality === 'low') return; // Option to disable slow-mo

        this.slowMotionFactor = factor;
        this.slowMotionDuration = duration / 1000; // Convert ms to seconds
        this.currentSlowMotionTime = this.slowMotionDuration;
        this.isSlowMotion = true;
    }

    triggerHitStop(duration = 100) { // duration in ms
        if (this.options.quality === 'low') return;

        this.hitStopDuration = duration / 1000; // Convert ms to seconds
        this.currentHitStopTime = this.hitStopDuration;
        this.isHitStop = true;
    }

    update(deltaTime) { // deltaTime here is the potentially modified game simulation deltaTime
        const allEntities = this.entityManager.getAllEntities();

        // Pass playerInputDisabled state to PlayerInputSystem
        const playerInputSystem = this.systems.find(s => s instanceof PlayerInputSystem);
        if (playerInputSystem && typeof playerInputSystem.setInputDisabled === 'function') {
            playerInputSystem.setInputDisabled(this.playerInputDisabled);
        }

        for (const system of this.systemUpdateOrder) {
            system.update(allEntities, deltaTime, this.entityManager, this.ctx, this.camera, this.physics, this.controls,
                          this.systems.find(s => s instanceof ParticleSystem),
                          this.systems.find(s => s instanceof EffectSystem),
                          this);
        }

        // Old direct update calls are removed:
        // this.updatePlayerBot(inputState, deltaTime);
        // this.updateEnemyAI(deltaTime);
        // this.physics.update(deltaTime); // This is now called within PhysicsSystem
        // this.updateEntitiesFromPhysics(physicsData); // This is now done by PhysicsSystem
        
        this.updateCamera(deltaTime); // Camera can still be updated here or by RenderSystem
        // this.updateParticles(deltaTime);
        // this.updateUI();
    }

    triggerScreenShake(intensity, duration) {
        if (this.options.quality === 'low') return; // Option to disable shake on low quality

        this.camera.shakeIntensity = intensity;
        this.camera.shakeDuration = duration;
        this.camera.currentShakeTime = duration;
    }

    updateCamera(deltaTime) {
        if (this.camera.target) {
            const targetPosition = this.camera.target.getComponent(PositionComponent);
            if (targetPosition) {
                const lerpFactor = 5 * deltaTime; // Smooth follow
                this.camera.targetX += (targetPosition.x - this.camera.targetX) * lerpFactor;
                this.camera.targetY += (targetPosition.y - this.camera.targetY) * lerpFactor;
            }
        }

        // Apply screen shake
        if (this.camera.currentShakeTime > 0) {
            const intensity = this.camera.shakeIntensity * (this.camera.currentShakeTime / this.camera.shakeDuration); // Fade shake
            this.camera.currentX = this.camera.targetX + (Math.random() - 0.5) * intensity * 2;
            this.camera.currentY = this.camera.targetY + (Math.random() - 0.5) * intensity * 2;
            
            this.camera.currentShakeTime -= deltaTime;
            if (this.camera.currentShakeTime <= 0) {
                this.camera.shakeIntensity = 0;
                this.camera.currentX = this.camera.targetX; // Reset to exact target
                this.camera.currentY = this.camera.targetY;
            }
        } else {
            this.camera.currentX = this.camera.targetX;
            this.camera.currentY = this.camera.targetY;
        }
        // RenderSystem will use camera.currentX and camera.currentY
    }

    // updateParticles is obsolete. ParticleSystem will handle this.

    // updateUI() is now handled by RenderSystem.updateDOMUI()

    updateGameTimer() {
        if (!this.isRunning) return;
        
        const timeLeft = Math.max(0, this.maxGameTime - this.gameTime);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        const timerElement = document.getElementById('game-timer');
        if (timerElement) {
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        setTimeout(() => this.updateGameTimer(), 100);
    }

    render() {
        // All rendering is now handled by RenderSystem, which is called during the main update loop.
        // This method is now effectively empty.
    }

    // All drawing methods, old particle creation methods, and old direct action methods
    // (like firePlayerWeapon, activateSpecialAbility) are now removed as their logic
    // is handled by respective ECS systems.

    // Event handlers can remain if they are for game-level events or stats.
    handleBotHit(data) {
        const { botId, damage, position } = data;
        const entity = this.entityManager.getEntityById(botId);

        if (entity) {
            // Health reduction is handled by CollisionSystem.
            // This handler is now primarily for stats and sound.
            if (botId === 'enemy') {
                this.gameStats.hits++;
                this.gameStats.damage += damage;
            }
            
            // Particle effect calls are now in CollisionSystem.
            // This handler could still play sounds or trigger other non-ECS responses.
            this.options.audioManager.playSound('hit');
            if (this.options.hapticFeedback) this.options.audioManager.vibrate([30, 10, 30]);
        }
    }

    handleProjectileHitWall(data) {
        const { projectileId, position } = data;
        // Particle effect calls are now in CollisionSystem.
        // This handler could play sounds for wall hits.
        // this.options.audioManager.playSound('wallHit'); // Example
    }

    checkGameEnd() { // This logic remains, as it's high-level game state.
        const playerEntity = this.entityManager.getEntityById('player');
        const enemyEntity = this.entityManager.getEntityById('enemy');

        let gameOver = false;
        let victory = false;

        const playerHealth = playerEntity ? playerEntity.getComponent(HealthComponent) : null;
        const enemyHealth = enemyEntity ? enemyEntity.getComponent(HealthComponent) : null;

        if (playerHealth && !playerHealth.isAlive()) {
            gameOver = true;
            victory = false;
        } else if (enemyHealth && !enemyHealth.isAlive()) {
            gameOver = true;
            victory = true;
        }
        
        if (!gameOver && this.gameTime >= this.maxGameTime) {
            gameOver = true;
            victory = playerHealth && enemyHealth ? playerHealth.currentHealth > enemyHealth.currentHealth : (playerHealth ? true : false);
        }
        
        if (gameOver) {
            this.endGame(victory);
        }
    }

    endGame(victory) {
        this.isRunning = false;
        this.playerInputDisabled = true; // Disable input post-game as well
        
        this.postGameMessage = victory ? "VICTORY!" : "DEFEAT!";
        this.showingPostGameMessage = true; // RenderSystem will pick this up
        
        if (this.options.audioManager) {
            this.options.audioManager.playSound(victory ? 'victory' : 'defeat');
        }

        // After a delay, hide the message and emit gameOver to transition to stats screen
        setTimeout(() => {
            this.showingPostGameMessage = false;
            // this.postGameMessage = ""; // Clearing it here might be too soon if RenderSystem needs it for fade out

            const endTime = Date.now();
            const duration = endTime - this.gameStats.startTime;
            const accuracy = this.gameStats.shots > 0 ? Math.round((this.gameStats.hits / this.gameStats.shots) * 100) : 0;

            const resultData = { // Renamed to avoid conflict with 'result' variable name if any
                victory,
                time: this.formatTime(duration),
                timeSeconds: duration / 1000,
                damage: this.gameStats.damage,
                accuracy,
                duration
            };

            this.emit('gameOver', resultData);
            console.log('Game ended:', resultData);

        }, 2500); // Show message for 2.5 seconds
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        const pauseMenu = document.getElementById('pause-menu');

        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
        }
        if (pauseMenu) {
            if (this.isPaused) {
                // pauseMenu.style.display = 'flex'; // Using flex to center content
                // setTimeout(() => pauseMenu.classList.add('active'), 10); // Trigger transition
                pauseMenu.classList.add('active'); // Assumes .screen.active handles visibility and opacity
                pauseMenu.style.transform = 'none'; // Ensure it's centered if base .screen transform was translateX(100%)
                pauseMenu.style.opacity = '1';
                pauseMenu.style.visibility = 'visible';


            } else {
                // pauseMenu.classList.remove('active');
                // setTimeout(() => pauseMenu.style.display = 'none', 300); // Hide after transition
                pauseMenu.style.opacity = '0';
                pauseMenu.style.visibility = 'hidden';
                // No need to change display to none if using visibility for transitions + overlay nature
            }
        }
        this.emit('pause', this.isPaused); // Emit event for other listeners (e.g. app.js)
    }

    pause() { // Ensure this also shows menu if called externally
        if (!this.isPaused) {
            this.togglePause();
        }
    }
    resume() { // Ensure this also hides menu
        if (this.isPaused) {
            this.togglePause();
        }
    }

    setZoom(zoom) { this.camera.zoom = zoom; }

    handleResize() { this.setupCanvas(); }

    on(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    destroy() {
        this.isRunning = false;
        if (this.physics) this.physics.cleanup();
        if (this.controls) this.controls.cleanup();
        
        this.entityManager.getAllEntities().forEach(entity => this.entityManager.removeEntity(entity.id));
        
        for (const system of this.systems) {
            if (typeof system.destroy === 'function') {
                system.destroy();
            }
        }
        this.systems = [];
        this.systemUpdateOrder = [];
        this.eventListeners = {};
        console.log('GameEngine destroyed and cleaned up.');
    }
}
// Note: The drawing methods (drawArenaBackground, etc.) and some logic (firePlayerWeapon)
// are still in GameEngine.js. These need to be moved into their respective Systems
// (RenderSystem, WeaponSystem, etc.) in subsequent steps.
// The current goal is to get the core ECS loop running with entities and components.

