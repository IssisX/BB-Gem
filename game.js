import { PhysicsEngine } from './physics.js';
import { ControlsManager } from './controls.js';

// ECS Core
import Entity from './src/Entity.js';
import EntityManager from './src/EntityManager.js';

// Components
import PositionComponent from './src/components/PositionComponent.js';
import VelocityComponent from './src/components/VelocityComponent.js';
import RenderComponent from './src/components/RenderComponent.js';
import PhysicsComponent from './src/components/PhysicsComponent.js';
import PlayerControlledComponent from './src/components/PlayerControlledComponent.js';
import AIControlledComponent from './src/components/AIControlledComponent.js';
import HealthComponent from './src/components/HealthComponent.js';
import EnergyComponent from './src/components/EnergyComponent.js';
import WeaponComponent from './src/components/WeaponComponent.js';
import AnimationComponent from './src/components/AnimationComponent.js';
// ProjectileComponent and EffectComponent are used by systems, not directly by GameEngine usually.
// If GameEngine needed them, they would be imported here.

// Systems
import PhysicsSystem from './src/systems/PhysicsSystem.js';
import RenderSystem from './src/systems/RenderSystem.js';
import PlayerInputSystem from './src/systems/PlayerInputSystem.js';
import AISystem from './src/systems/AISystem.js';
import CollisionSystem from './src/systems/CollisionSystem.js';
import EnergySystem from './src/systems/EnergySystem.js';
import HealthSystem from './src/systems/HealthSystem.js';
import ParticleSystem from './src/systems/ParticleSystem.js';
import EffectSystem from './src/systems/EffectSystem.js';
import AnimationSystem from './src/systems/AnimationSystem.js';
import * as CANNON from 'cannon'; // Corrected import for Cannon.js

export class GameEngine {
    constructor(canvas, options, dataManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options; // Game settings from app.js
        this.dataManager = dataManager; // DataManager instance
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.gameTime = 0;
        this.maxGameTime = 120000;
        
        this.physics = null;
        this.controls = null;
        this.camera = {
            targetX: 0, targetY: 0, currentX: 0, currentY: 0, zoom: 1,
            target: null,
            shakeIntensity: 0, shakeDuration: 0, currentShakeTime: 0
        };
        
        this.entityManager = new EntityManager();
        this.systems = [];
        this.systemUpdateOrder = [];

        this.isSlowMotion = false;
        this.slowMotionFactor = 0.5;
        this.slowMotionDuration = 0;
        this.currentSlowMotionTime = 0;

        this.isHitStop = false;
        this.hitStopDuration = 0;
        this.currentHitStopTime = 0;

        this.countdownMessage = "";
        this.postGameMessage = "";
        this.showingPostGameMessage = false;
        this.playerInputDisabled = false;

        this.gameStats = { damage: 0, hits: 0, shots: 0, startTime: 0 };
        this.eventListeners = {};
        
        this.currentMapData = null; // To store loaded map data

        this.init();
    }

    async init() {
        this.setupCanvas();
        
        // Pass necessary options to PhysicsEngine if its constructor uses them
        this.physics = new PhysicsEngine(this.options);
        // Pass gameEngine instance (this) and options to ControlsManager.
        // Also pass the callback for adaptive UI.
        this.controls = new ControlsManager(this, this.options, this.options.onInputTypeChange);

        // Initialize Systems
        const effectSystem = new EffectSystem(this.entityManager);
        const particleSystem = new ParticleSystem(this.entityManager, { particleQuality: this.options.quality }, effectSystem);
        const animationSystem = new AnimationSystem(this.entityManager);
        const renderSystem = new RenderSystem(this.ctx, this.entityManager, this.camera, this);

        this.systems.push(new PlayerInputSystem(this.controls));
        this.systems.push(new AISystem(this.entityManager));
        this.systems.push(new PhysicsSystem(this.physics, this.entityManager));
        this.systems.push(new CollisionSystem(this.physics, this.entityManager, particleSystem, effectSystem));
        this.systems.push(new EnergySystem());
        this.systems.push(new HealthSystem(this.entityManager, particleSystem, effectSystem));
        this.systems.push(particleSystem);
        this.systems.push(effectSystem);
        this.systems.push(animationSystem);
        this.systems.push(renderSystem);

        this.systemUpdateOrder = [
            PlayerInputSystem, AISystem, EnergySystem, PhysicsSystem, CollisionSystem,
            HealthSystem, ParticleSystem, EffectSystem, AnimationSystem, RenderSystem,
        ].map(SystemClass => this.systems.find(s => s instanceof SystemClass)).filter(s => s);

        this.physics.on('botHit', this.handleBotHit.bind(this));
        this.physics.on('projectileHitWall', this.handleProjectileHitWall.bind(this));

        // Load a default level. App.js can call loadLevel with different IDs to change maps/bots.
        const defaultMapId = this.options.defaultMapId || 'arena_basic_v1';
        const defaultPlayerConfigId = this.options.defaultPlayerConfigId || 'player_starter_balanced';
        const defaultEnemyConfigId = this.options.defaultEnemyConfigId || 'enemy_grunt_blaster_v1';
        this.loadLevel(defaultMapId, defaultPlayerConfigId, defaultEnemyConfigId);
        
        this.setupEventListeners();
        console.log('Game engine initialized, level loading initiated.');
    }

    loadLevel(mapId, playerBotConfigId, enemyBotConfigId) {
        if (!this.dataManager) {
            console.error("DataManager not available. Cannot load level.");
            return;
        }
        const mapData = this.dataManager.getMapDataById(mapId);
        if (!mapData) {
            console.error(`Map data for ${mapId} not found.`);
            return;
        }
        this.currentMapData = mapData;

        // 1. Clear existing entities
        this.entityManager.getAllEntities().forEach(entity => {
            const physicsComp = entity.getComponent(PhysicsComponent);
            if (physicsComp && physicsComp.body) {
                this.physics.world.removeBody(physicsComp.body);
            }
            this.entityManager.removeEntity(entity.id);
        });
        // Reset game state for the new level
        this.gameTime = 0;
        this.playerInputDisabled = false; // Re-enable input before countdown starts it
        // Clear any active countdown/post-game messages
        this.countdownMessage = "";
        this.showingPostGameMessage = false;
        this.postGameMessage = "";


        // 2. Update RenderSystem with new map info
        const renderSys = this.systems.find(s => s instanceof RenderSystem);
        if (renderSys) {
            if (typeof renderSys.setMap === 'function') {
                renderSys.setMap(this.currentMapData);
            } else {
                renderSys.mapDimensions = this.currentMapData.dimensions;
                renderSys.mapBackgroundInfo = this.currentMapData.background;
            }
        }

        // 3. Create obstacles
        if (this.currentMapData.obstacles) {
            this.currentMapData.obstacles.forEach(obsData => {
                this.createObstacle(obsData);
            });
        }

        // 4. Create player and enemy bots
        const playerBotConfig = this.dataManager.getBotConfigById(playerBotConfigId);
        const enemyBotConfig = this.dataManager.getBotConfigById(enemyBotConfigId);

        const playerStartPos = this.currentMapData.playerStartPositions?.[0] || { x: -200, y: 0, angle: 0 }; // Default start
        const enemyStartPos = this.currentMapData.playerStartPositions?.[1] || { x: 200, y: 0, angle: 180 }; // Default start

        if (playerBotConfig) {
            this.createPlayerBot(playerBotConfig, playerStartPos);
        } else {
            console.error(`Player BotConfig '${playerBotConfigId}' not found.`);
        }

        if (enemyBotConfig) {
            this.createEnemyBot(enemyBotConfig, enemyStartPos);
        } else {
            console.error(`Enemy BotConfig '${enemyBotConfigId}' not found.`);
        }
        console.log(`Level ${mapId} loaded with bots. Player at (${playerStartPos.x}, ${playerStartPos.y}), Enemy at (${enemyStartPos.x}, ${enemyStartPos.y})`);

        // After loading level, if game is meant to start immediately, call start() which includes countdown
        // this.start(); // Or app.js calls start after loadLevel completes
    }

    createObstacle(obstacleData) {
        const entity = this.entityManager.createEntity(obstacleData.obstacleId || `obstacle_${Math.random().toString(36).substr(2, 9)}`);

        entity.addComponent(new PositionComponent(obstacleData.x, obstacleData.y, obstacleData.z || 0));

        const renderInfo = obstacleData.render || {};
        const visualWidth = renderInfo.width || obstacleData.width || 50;
        const visualHeight = renderInfo.height || obstacleData.height || 50;

        entity.addComponent(new RenderComponent(
            renderInfo.shape || 'rectangle',
            renderInfo.color || '#777777',
            renderInfo.sprite, true, 0, visualWidth
        ));
        // If RenderComponent needs separate height for non-square shapes:
        // if(renderInfo.shape === 'rectangle') entity.getComponent(RenderComponent).height = visualHeight;

        const physicsInfo = obstacleData.physics || {};
        const physicalWidth = obstacleData.width || 50;
        const physicalDepth = obstacleData.depth || obstacleData.height || 50;
        const physicalHeight = physicsInfo.bodyHeight || 50; // Actual height of the physics body in 3D space (Cannon Y)

        const bodyOptions = {
            mass: physicsInfo.isStatic === false && physicsInfo.mass !== undefined ? physicsInfo.mass : 0,
            position: new CANNON.Vec3(obstacleData.x, physicalHeight / 2, obstacleData.y),
            fixedRotation: physicsInfo.fixedRotation !== undefined ? physicsInfo.fixedRotation : true,
            linearDamping: physicsInfo.linearDamping !== undefined ? physicsInfo.linearDamping : 0.5,
            angularDamping: physicsInfo.angularDamping !== undefined ? physicsInfo.angularDamping : 0.8,
            material: this.physics.materials.wallMaterial // TODO: Make material configurable from JSON
        };

        let shape;
        const shapeType = physicsInfo.shape || (obstacleData.radius ? 'sphere' : 'box');
        if (shapeType === 'sphere') {
            shape = new CANNON.Sphere(obstacleData.radius || physicalWidth/2);
             bodyOptions.position.y = obstacleData.radius || physicalWidth/2;
        } else if (shapeType === 'cylinder') {
            shape = new CANNON.Cylinder(obstacleData.radius || physicalWidth/2, obstacleData.radius || physicalWidth/2, physicalHeight, 12);
        } else {
             shape = new CANNON.Box(new CANNON.Vec3(physicalWidth / 2, physicalHeight / 2, physicalDepth / 2));
        }

        const body = new CANNON.Body(bodyOptions);
        body.addShape(shape);
        if (obstacleData.rotation) {
            body.quaternion.setFromEuler(0, obstacleData.rotation * Math.PI / 180, 0);
        }
        body.userData = { entityId: entity.id, type: 'obstacle', ...obstacleData };
        this.physics.world.addBody(body);

        entity.addComponent(new PhysicsComponent(body, {
            mass: bodyOptions.mass,
            size: { width: physicalWidth, height: physicalHeight, depth: physicalDepth, radius: obstacleData.radius },
            linearDamping: bodyOptions.linearDamping,
            angularDamping: bodyOptions.angularDamping,
            friction: physicsInfo.friction,
            restitution: physicsInfo.restitution
        }));
        return entity;
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
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());
        this.on('swipeDown', () => this.togglePause());
        this.on('swipeUp', () => {
            const playerEntity = this.entityManager.getEntityById('player');
            if(playerEntity && playerEntity.hasComponent(PlayerControlledComponent)) {
                console.log("Swipe up detected for player special ability - system should handle this.");
            }
        });
    }

    createBotEntity(entityId, botConfig, initialPos, isPlayer = false) {
        if (!this.dataManager) {
            console.error("DataManager not available. Cannot create bot.");
            return null;
        }
        const chassisData = this.dataManager.getPartById(botConfig.chassisId);
        if (!chassisData) {
            console.error(`Chassis ID ${botConfig.chassisId} not found for bot ${entityId}.`);
            return null;
        }
        const armorData = botConfig.armorId ? this.dataManager.getPartById(botConfig.armorId) : null;
        const weaponDataArray = (botConfig.weaponIds || [])
            .map(id => this.dataManager.getPartById(id))
            .filter(p => p); // Filter out nulls if a weapon ID isn't found

        const entity = this.entityManager.createEntity(entityId);

        let totalHealth = chassisData.stats.baseHealth;
        let totalMass = chassisData.stats.mass;
        if (armorData && armorData.stats.addedHealth) totalHealth += armorData.stats.addedHealth;
        if (armorData && armorData.stats.addedMass) totalMass += armorData.stats.addedMass;

        const physicsOptions = {
            mass: totalMass,
            size: chassisData.stats.size || { width: 60, height: 80, depth: 60 },
            accelerationForce: chassisData.stats.accelerationForce,
            maxSpeed: chassisData.stats.maxSpeed,
            linearDamping: chassisData.stats.linearDamping,
            angularDamping: chassisData.stats.angularDamping,
            friction: chassisData.stats.friction || 0.2,
            restitution: chassisData.stats.restitution || 0.1
        };
        
        const botBody = this.physics.createBot(entityId, initialPos.x, initialPos.y, {
            width: physicsOptions.size.width,
            height: physicsOptions.size.depth, // Use depth from chassis size for physics body height
            mass: physicsOptions.mass,
            maxSpeed: physicsOptions.maxSpeed,
            acceleration: physicsOptions.accelerationForce,
            linearDamping: physicsOptions.linearDamping,
            angularDamping: physicsOptions.angularDamping
        });
        botBody.userData = { entityId: entityId };
        if (initialPos.angle !== undefined) { // Set initial rotation from map data
            botBody.quaternion.setFromEuler(0, initialPos.angle * Math.PI / 180, 0); // Assuming Y-up
        }


        entity.addComponent(new PositionComponent(initialPos.x, initialPos.y))
              .addComponent(new VelocityComponent())
              .addComponent(new PhysicsComponent(botBody, physicsOptions));

        const renderComp = new RenderComponent(
            chassisData.renderShape || 'bot',
            isPlayer ? (botConfig.cosmeticOverrides?.primaryColor || '#00ffff') : (botConfig.cosmeticOverrides?.primaryColor ||'#ff0040'),
            botConfig.cosmeticOverrides?.chassisSprite || chassisData.sprite,
            true, 1, chassisData.stats.renderSize || 30
        );

        renderComp.layers.push({
            partType: 'chassis', sprite: botConfig.cosmeticOverrides?.chassisSprite || chassisData.sprite,
            offsetX: 0, offsetY: 0, rotation: 0, zOrderOffset: 0,
            width: chassisData.stats.renderSize || 60,
            height: chassisData.stats.renderSize || (chassisData.stats.size?.height || 60)
        });

        weaponDataArray.forEach((weaponData, index) => {
            if (weaponData && weaponData.sprite) {
                const slotId = `weaponSlot${index + 1}`; // e.g. weaponSlot1
                const attachPoint = chassisData.attachmentPoints?.[slotId] || {x:0, y: index * 5, defaultRotation:0}; // Basic fallback if slot not defined
                renderComp.layers.push({
                    partType: `weapon_${index}`, sprite: weaponData.sprite,
                    offsetX: attachPoint.x, offsetY: attachPoint.y, rotation: attachPoint.defaultRotation || 0,
                    zOrderOffset: 1 + index,
                    width: weaponData.renderInfo?.width || weaponData.stats.projectileSize * 2 || 20,
                    height: weaponData.renderInfo?.height || weaponData.stats.projectileSize * 4 || 40,
                });
                // For now, only use the first weapon's stats for the WeaponComponent
                if (index === 0) {
                     entity.addComponent(new WeaponComponent(
                        weaponData.stats.fireRate, weaponData.stats.projectileType || weaponData.renderInfo.shape,
                        weaponData.stats.projectileSpeed, weaponData.stats.damage,
                        weaponData.stats.projectileSize, weaponData.stats.projectileColor,
                        weaponData.stats.projectileLifetime * 1000, weaponData.stats.energyCost,
                        weaponData.stats.spread, weaponData.renderInfo
                    ));
                }
            }
        });

        entity.addComponent(renderComp)
              .addComponent(new HealthComponent(totalHealth))
              .addComponent(new EnergyComponent(chassisData.stats.baseEnergy, chassisData.stats.energyRegenRate || 10));

        if (isPlayer) entity.addComponent(new PlayerControlledComponent());
        else entity.addComponent(new AIControlledComponent(botConfig.aiBehaviorHint || 'seeking', null));

        entity.addComponent(new AnimationComponent({
            'fireRecoil': {
                targetProperties: { renderOffsetY: - (chassisData.stats.renderSize || 30) * 0.1, animationScale: 0.97 },
                duration: 0.075, easingFunction: 'easeOutQuad', resetsToOriginal: true
            },
            'hitReact': {
                targetProperties: { animationTintColor: 'rgba(255,100,100,0.6)' },
                duration: 0.15, easingFunction: 'linear', resetsToOriginal: true
            }
        }));
        return entity;
    }

    createPlayerBot(botConfig, startPosition) {
        const playerEntity = this.createBotEntity('player', botConfig, startPosition, true);
        if (playerEntity) {
            this.camera.target = playerEntity;
            const posComp = playerEntity.getComponent(PositionComponent);
            this.camera.targetX = posComp.x; this.camera.targetY = posComp.y;
            this.camera.currentX = posComp.x; this.camera.currentY = posComp.y;
        }
    }

    createEnemyBot(botConfig, startPosition) {
        this.createBotEntity('enemy', botConfig, startPosition, false);
    }

    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.gameTime = 0;
        this.gameStats.startTime = Date.now();
        this.startMatchCountdown();
        this.updateGameTimer();
    }

    startMatchCountdown() {
        this.playerInputDisabled = true;
        const messages = ['3', '2', '1', 'FIGHT!'];
        let currentMessageIndex = 0;
        this.countdownMessage = messages[currentMessageIndex];
        const renderSys = this.systems.find(s => s instanceof RenderSystem);
        if(renderSys) renderSys.updateDOMUI(this.entityManager); // Initial display of '3'

        const countdownInterval = setInterval(() => {
            currentMessageIndex++;
            if (currentMessageIndex < messages.length) {
                this.countdownMessage = messages[currentMessageIndex];
                if(renderSys) renderSys.updateDOMUI(this.entityManager);
            } else {
                clearInterval(countdownInterval);
                this.countdownMessage = "";
                if(renderSys) renderSys.updateDOMUI(this.entityManager);
                this.playerInputDisabled = false;
                console.log('FIGHT!');
            }
        }, 1000);
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;
        
        const actualDeltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        let currentDeltaTime = actualDeltaTime;

        if (this.isHitStop) {
            this.currentHitStopTime -= actualDeltaTime;
            if (this.currentHitStopTime <= 0) this.isHitStop = false;
            currentDeltaTime = 0.00001;
            if (this.isHitStop) {
                 requestAnimationFrame(this.gameLoop.bind(this));
                 return; // Effectively freeze most game logic
            }
        }

        if (this.isSlowMotion && !this.isHitStop) {
            currentDeltaTime *= this.slowMotionFactor;
            this.currentSlowMotionTime -= actualDeltaTime;
            if (this.currentSlowMotionTime <= 0) this.isSlowMotion = false;
        }
        
        if (!this.isPaused) {
            this.update(currentDeltaTime);
            this.gameTime += actualDeltaTime * 1000;
            this.checkGameEnd();
        }
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    triggerSlowMotion(factor = 0.5, duration = 1000) {
        if (this.options.quality === 'low' && !this.options.allowSlowMoOnLow) return;
        this.slowMotionFactor = factor;
        this.slowMotionDuration = duration / 1000;
        this.currentSlowMotionTime = this.slowMotionDuration;
        this.isSlowMotion = true;
    }

    triggerHitStop(duration = 100) {
        if (this.options.quality === 'low' && !this.options.allowHitStopOnLow) return;
        this.hitStopDuration = duration / 1000;
        this.currentHitStopTime = this.hitStopDuration;
        this.isHitStop = true;
    }

    update(deltaTime) {
        const allEntities = this.entityManager.getAllEntities();
        const playerInputSystem = this.systems.find(s => s instanceof PlayerInputSystem);
        if (playerInputSystem && typeof playerInputSystem.setInputDisabled === 'function') {
            playerInputSystem.setInputDisabled(this.playerInputDisabled);
        }

        const particleSys = this.systems.find(s => s instanceof ParticleSystem);
        const effectSys = this.systems.find(s => s instanceof EffectSystem);

        for (const system of this.systemUpdateOrder) {
            system.update(allEntities, deltaTime, this.entityManager, this.ctx, this.camera,
                          this.physics, this.controls, particleSys, effectSys, this);
        }
        this.updateCamera(deltaTime);
    }

    triggerScreenShake(intensity, duration) {
        if (this.options.quality === 'low' && !this.options.allowScreenShakeOnLow) return;
        this.camera.shakeIntensity = intensity;
        this.camera.shakeDuration = duration;
        this.camera.currentShakeTime = duration;
    }

    updateCamera(deltaTime) {
        if (this.camera.target) {
            const targetPosition = this.camera.target.getComponent(PositionComponent);
            if (targetPosition) {
                const lerpFactor = 5 * deltaTime;
                this.camera.targetX += (targetPosition.x - this.camera.targetX) * lerpFactor;
                this.camera.targetY += (targetPosition.y - this.camera.targetY) * lerpFactor;
            }
        }
        if (this.camera.currentShakeTime > 0) {
            const intensity = this.camera.shakeIntensity * (this.camera.currentShakeTime / this.camera.shakeDuration);
            this.camera.currentX = this.camera.targetX + (Math.random() - 0.5) * intensity * 2;
            this.camera.currentY = this.camera.targetY + (Math.random() - 0.5) * intensity * 2;
            this.camera.currentShakeTime -= deltaTime;
            if (this.camera.currentShakeTime <= 0) {
                this.camera.shakeIntensity = 0;
                this.camera.currentX = this.camera.targetX;
                this.camera.currentY = this.camera.targetY;
            }
        } else {
            this.camera.currentX = this.camera.targetX;
            this.camera.currentY = this.camera.targetY;
        }
    }

    updateGameTimer() {
        if (!this.isRunning) return;
        const timeLeft = Math.max(0, this.maxGameTime - this.gameTime);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const timerElement = document.getElementById('game-timer');
        if (timerElement) timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        setTimeout(() => this.updateGameTimer(), 1000); // Update every second
    }

    render() { /* Effectively empty, RenderSystem handles drawing */ }

    handleBotHit(data) {
        const { botId, damage, position } = data;
        const entity = this.entityManager.getEntityById(botId);
        if (entity) {
            if (botId === 'enemy') {
                this.gameStats.hits++;
                this.gameStats.damage += damage;
            }
            if(this.options.audioManager) this.options.audioManager.playSound('hit');
            if (this.options.hapticFeedback && navigator.vibrate) navigator.vibrate([30, 10, 30]);
        }
    }

    handleProjectileHitWall(data) {
        // if(this.options.audioManager) this.options.audioManager.playSound('wallHit');
    }

    checkGameEnd() {
        if (!this.isRunning || this.showingPostGameMessage) return; // Don't check if game already ended or is ending

        const playerEntity = this.entityManager.getEntityById('player');
        const enemyEntity = this.entityManager.getEntityById('enemy');
        let gameOver = false;
        let victory = false;

        const playerHealth = playerEntity ? playerEntity.getComponent(HealthComponent) : null;
        const enemyHealth = enemyEntity ? enemyEntity.getComponent(HealthComponent) : null;

        if (playerHealth && !playerHealth.isAlive()) { gameOver = true; victory = false; }
        else if (enemyHealth && !enemyHealth.isAlive()) { gameOver = true; victory = true; }
        
        if (!gameOver && this.gameTime >= this.maxGameTime) {
            gameOver = true;
            victory = playerHealth && enemyHealth ? playerHealth.currentHealth > enemyHealth.currentHealth : (playerHealth ? true : false);
        }
        if (gameOver) this.endGame(victory);
    }

    endGame(victory) {
        if (!this.isRunning && this.showingPostGameMessage) return; // Prevent multiple calls if already ending

        this.isRunning = false;
        this.playerInputDisabled = true;
        this.postGameMessage = victory ? "VICTORY!" : "DEFEAT!";
        this.showingPostGameMessage = true;
        
        const renderSys = this.systems.find(s => s instanceof RenderSystem);
        if(renderSys) renderSys.updateDOMUI(this.entityManager); // Update to show message immediately

        if (this.options.audioManager) {
            this.options.audioManager.playSound(victory ? 'victory' : 'defeat');
        }

        setTimeout(() => {
            this.showingPostGameMessage = false;
            if(renderSys) renderSys.updateDOMUI(this.entityManager); // Update to hide message

            const endTime = Date.now();
            const duration = endTime - this.gameStats.startTime;
            const accuracy = this.gameStats.shots > 0 ? Math.round((this.gameStats.hits / this.gameStats.shots) * 100) : 0;
            const resultData = { victory, time: this.formatTime(duration), timeSeconds: duration / 1000, damage: this.gameStats.damage, accuracy, duration };
            this.emit('gameOver', resultData);
            console.log('Game ended:', resultData);
        }, 2500);
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const rs = seconds % 60;
        return `${minutes}:${rs.toString().padStart(2, '0')}`;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseBtn) pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
        if (pauseMenu) {
            if (this.isPaused) {
                pauseMenu.classList.add('active');
                pauseMenu.style.transform = 'none';
                pauseMenu.style.opacity = '1';
                pauseMenu.style.visibility = 'visible';
            } else {
                pauseMenu.style.opacity = '0';
                pauseMenu.style.visibility = 'hidden';
                // Consider removing 'active' class after transition via event listener if it affects other things
            }
        }
        this.emit('pause', this.isPaused);
    }

    pause() { if (!this.isPaused) this.togglePause(); }
    resume() { if (this.isPaused) this.togglePause(); }

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
        // Clear any intervals (like countdown)
        if (this.countdownInterval) clearInterval(this.countdownInterval); // Ensure interval ID is stored

        if (this.physics) this.physics.cleanup();
        if (this.controls) this.controls.cleanup();
        this.entityManager.getAllEntities().forEach(entity => this.entityManager.removeEntity(entity.id));
        this.systems.forEach(system => { if (typeof system.destroy === 'function') system.destroy(); });
        this.systems = [];
        this.systemUpdateOrder = [];
        this.eventListeners = {};
        console.log('GameEngine destroyed and cleaned up.');
    }
}
