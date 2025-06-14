import { PhysicsEngine } from './physics.js';
import { ControlsManager } from './controls.js';

export class GameEngine {
    constructor(canvas, options) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.gameTime = 0;
        this.maxGameTime = 120000; // 2 minutes
        
        this.physics = null;
        this.controls = null;
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            target: null
        };
        
        this.entities = new Map();
        this.particles = [];
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
        
        // Initialize physics
        this.physics = new PhysicsEngine(this.options);
        this.physics.on('botHit', this.handleBotHit.bind(this));
        this.physics.on('projectileHitWall', this.handleProjectileHitWall.bind(this));
        
        // Initialize controls
        this.controls = new ControlsManager(this, this.options);
        
        // Create player and enemy bots
        this.createPlayerBot();
        this.createEnemyBot();
        
        // Setup game event listeners
        this.setupEventListeners();
        
        console.log('Game engine initialized');
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Set rendering quality based on settings
        this.ctx.imageSmoothingEnabled = this.options.quality !== 'low';
    }

    setupEventListeners() {
        // Handle pause button
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
        
        // Handle swipe gestures
        this.on('swipeDown', () => {
            this.togglePause();
        });
        
        this.on('swipeUp', () => {
            // Quick special ability activation
            this.activateSpecialAbility();
        });
    }

    createPlayerBot() {
        const playerBot = this.physics.createBot('player', -500, 0, {
            width: 60,
            height: 80,
            mass: 100,
            maxSpeed: 400,
            acceleration: 1000
        });
        
        this.entities.set('player', {
            id: 'player',
            type: 'bot',
            isPlayer: true,
            body: playerBot,
            health: 100,
            maxHealth: 100,
            energy: 100,
            maxEnergy: 100,
            lastShot: 0,
            shotCooldown: 200
        });
        
        // Camera follows player
        this.camera.target = 'player';
    }

    createEnemyBot() {
        const enemyBot = this.physics.createBot('enemy', 500, 0, {
            width: 60,
            height: 80,
            mass: 100,
            maxSpeed: 300,
            acceleration: 800
        });
        
        this.entities.set('enemy', {
            id: 'enemy',
            type: 'bot',
            isPlayer: false,
            body: enemyBot,
            health: 100,
            maxHealth: 100,
            energy: 100,
            maxEnergy: 100,
            lastShot: 0,
            shotCooldown: 500,
            aiState: 'seeking',
            lastAIUpdate: 0
        });
    }

    start() {
        this.isRunning = true;
        this.isPaused = false;
        this.gameTime = 0;
        this.gameStats.startTime = Date.now();
        
        // Start game loop
        this.gameLoop();
        
        // Start game timer
        this.updateGameTimer();
        
        console.log('Game started');
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        if (!this.isPaused) {
            this.update(deltaTime);
            this.render();
            
            this.gameTime += deltaTime * 1000;
            
            // Check win/lose conditions
            this.checkGameEnd();
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(deltaTime) {
        // Update controls
        const inputState = this.controls.getInputState();
        
        // Update player bot
        this.updatePlayerBot(inputState, deltaTime);
        
        // Update enemy AI
        this.updateEnemyAI(deltaTime);
        
        // Update physics
        const physicsData = this.physics.update(deltaTime);
        
        // Update entities with physics data
        this.updateEntitiesFromPhysics(physicsData);
        
        // Update camera
        this.updateCamera(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Update UI
        this.updateUI();
    }

    updatePlayerBot(inputState, deltaTime) {
        const player = this.entities.get('player');
        if (!player) return;
        
        // Update physics with input
        this.physics.updateBot('player', inputState);
        
        // Handle firing
        if (inputState.firing && Date.now() - player.lastShot > player.shotCooldown) {
            this.firePlayerWeapon();
            player.lastShot = Date.now();
        }
        
        // Handle special ability
        if (inputState.special && player.energy >= 30) {
            this.activatePlayerSpecial();
            player.energy -= 30;
        }
        
        // Regenerate energy
        player.energy = Math.min(player.maxEnergy, player.energy + 20 * deltaTime);
    }

    updateEnemyAI(deltaTime) {
        const enemy = this.entities.get('enemy');
        const player = this.entities.get('player');
        
        if (!enemy || !player || Date.now() - enemy.lastAIUpdate < 100) return;
        
        enemy.lastAIUpdate = Date.now();
        
        const enemyPos = this.physics.getBodyPosition('enemy');
        const playerPos = this.physics.getBodyPosition('player');
        
        if (!enemyPos || !playerPos) return;
        
        const distance = Math.sqrt(
            Math.pow(playerPos.x - enemyPos.x, 2) + 
            Math.pow(playerPos.y - enemyPos.y, 2)
        );
        
        // Simple AI behavior
        let aiInput = {
            movement: { x: 0, y: 0 },
            targeting: playerPos,
            firing: false,
            special: false,
            shield: false
        };
        
        if (distance > 300) {
            // Move towards player
            const direction = {
                x: (playerPos.x - enemyPos.x) / distance,
                y: (playerPos.y - enemyPos.y) / distance
            };
            aiInput.movement = direction;
            enemy.aiState = 'seeking';
        } else if (distance < 150) {
            // Move away from player
            const direction = {
                x: -(playerPos.x - enemyPos.x) / distance,
                y: -(playerPos.y - enemyPos.y) / distance
            };
            aiInput.movement = direction;
            enemy.aiState = 'retreating';
        } else {
            // Circle strafe
            const angle = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x) + Math.PI/2;
            aiInput.movement = {
                x: Math.cos(angle) * 0.7,
                y: Math.sin(angle) * 0.7
            };
            enemy.aiState = 'circling';
        }
        
        // Fire at player
        if (distance < 400 && Date.now() - enemy.lastShot > enemy.shotCooldown) {
            aiInput.firing = true;
            enemy.lastShot = Date.now();
        }
        
        // Use special ability occasionally
        if (enemy.energy > 50 && Math.random() < 0.01) {
            aiInput.special = true;
            enemy.energy -= 30;
        }
        
        // Update physics with AI input
        this.physics.updateBot('enemy', aiInput);
        
        // Regenerate energy
        enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 15 * deltaTime);
    }

    updateEntitiesFromPhysics(physicsData) {
        physicsData.bodies.forEach(bodyData => {
            const entity = this.entities.get(bodyData.id);
            if (entity) {
                entity.position = bodyData.position;
                entity.rotation = bodyData.rotation;
                entity.velocity = bodyData.velocity;
                
                // Update health from physics
                if (bodyData.userData.health !== undefined) {
                    entity.health = bodyData.userData.health;
                }
            }
        });
    }

    updateCamera(deltaTime) {
        if (this.camera.target) {
            const target = this.entities.get(this.camera.target);
            if (target && target.position) {
                // Smooth camera following
                const lerpFactor = 5 * deltaTime;
                this.camera.x += (target.position.x - this.camera.x) * lerpFactor;
                this.camera.y += (target.position.y - this.camera.y) * lerpFactor;
            }
        }
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.life -= deltaTime;
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateUI() {
        const player = this.entities.get('player');
        const enemy = this.entities.get('enemy');
        
        // Update health bars
        if (player) {
            const playerHealthBar = document.getElementById('player-health');
            const playerHealthText = playerHealthBar.parentElement.querySelector('.health-text');
            if (playerHealthBar) {
                const healthPercent = (player.health / player.maxHealth) * 100;
                playerHealthBar.style.width = `${healthPercent}%`;
                playerHealthText.textContent = Math.ceil(player.health);
            }
            
            // Update energy bar
            const playerEnergyBar = document.getElementById('player-energy');
            if (playerEnergyBar) {
                const energyPercent = (player.energy / player.maxEnergy) * 100;
                playerEnergyBar.style.width = `${energyPercent}%`;
            }
        }
        
        if (enemy) {
            const enemyHealthBar = document.getElementById('enemy-health');
            const enemyHealthText = enemyHealthBar.parentElement.querySelector('.health-text');
            if (enemyHealthBar) {
                const healthPercent = (enemy.health / enemy.maxHealth) * 100;
                enemyHealthBar.style.width = `${healthPercent}%`;
                enemyHealthText.textContent = Math.ceil(enemy.health);
            }
        }
    }

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
        const ctx = this.ctx;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Save context
        ctx.save();
        
        // Apply camera transform
        ctx.translate(width/2, height/2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw arena background
        this.drawArenaBackground(ctx);
        
        // Draw entities
        this.entities.forEach(entity => {
            this.drawEntity(ctx, entity);
        });
        
        // Draw particles
        this.drawParticles(ctx);
        
        // Draw effects
        this.drawEffects(ctx);
        
        // Restore context
        ctx.restore();
        
        // Draw UI elements (not affected by camera)
        this.drawUI(ctx, width, height);
    }

    drawArenaBackground(ctx) {
        // Draw arena bounds
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(-1000, -1000, 2000, 2000);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const gridSize = 100;
        for (let x = -1000; x <= 1000; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, -1000);
            ctx.lineTo(x, 1000);
            ctx.stroke();
        }
        
        for (let y = -1000; y <= 1000; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(-1000, y);
            ctx.lineTo(1000, y);
            ctx.stroke();
        }
        
        // Draw obstacles
        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        
        const obstacles = [
            { x: 200, y: 200, width: 100, height: 100 },
            { x: -200, y: -200, width: 100, height: 100 },
            { x: 300, y: -300, width: 80, height: 150 },
            { x: -400, y: 100, width: 120, height: 80 }
        ];
        
        obstacles.forEach(obstacle => {
            ctx.fillRect(obstacle.x - obstacle.width/2, obstacle.y - obstacle.height/2, 
                        obstacle.width, obstacle.height);
            ctx.strokeRect(obstacle.x - obstacle.width/2, obstacle.y - obstacle.height/2, 
                          obstacle.width, obstacle.height);
        });
    }

    drawEntity(ctx, entity) {
        if (!entity.position) return;
        
        ctx.save();
        ctx.translate(entity.position.x, entity.position.y);
        ctx.rotate(entity.rotation || 0);
        
        if (entity.type === 'bot') {
            this.drawBot(ctx, entity);
        } else if (entity.type === 'projectile') {
            this.drawProjectile(ctx, entity);
        }
        
        ctx.restore();
        
        // Draw health bar for bots
        if (entity.type === 'bot') {
            this.drawHealthBar(ctx, entity);
        }
    }

    drawBot(ctx, bot) {
        const size = 30;
        const color = bot.isPlayer ? '#00ffff' : '#ff0040';
        
        // Draw bot body
        ctx.fillStyle = color + '40';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(-size, -size, size*2, size*2, 8);
        ctx.fill();
        ctx.stroke();
        
        // Draw direction indicator
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(size + 10, 0);
        ctx.stroke();
        
        // Draw shield effect
        if (bot.body && bot.body.userData.shields) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw energy glow
        if (bot.energy > 50) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    drawProjectile(ctx, projectile) {
        const size = 3;
        const color = '#ffff00';
        
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Draw trail
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
    }

    drawHealthBar(ctx, entity) {
        if (!entity.position || entity.health >= entity.maxHealth) return;
        
        const barWidth = 40;
        const barHeight = 4;
        const x = entity.position.x - barWidth/2;
        const y = entity.position.y - 50;
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health bar
        const healthPercent = entity.health / entity.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }

    drawParticles(ctx) {
        this.particles.forEach(particle => {
            ctx.save();
            
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha;
            
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        });
    }

    drawEffects(ctx) {
        // Draw any special effects here
    }

    drawUI(ctx, width, height) {
        // Draw minimap
        this.drawMinimap(ctx, width - 120, 10, 100, 100);
    }

    drawMinimap(ctx, x, y, width, height) {
        ctx.save();
        
        // Minimap background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, width, height);
        
        // Minimap border
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Scale factor for minimap
        const scale = width / 2000; // Arena is 2000x2000
        
        ctx.translate(x + width/2, y + height/2);
        ctx.scale(scale, scale);
        
        // Draw entities on minimap
        this.entities.forEach(entity => {
            if (entity.position) {
                const color = entity.isPlayer ? '#00ffff' : '#ff0040';
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(entity.position.x, entity.position.y, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        ctx.restore();
    }

    firePlayerWeapon() {
        this.gameStats.shots++;
        this.options.audioManager.playSound('shoot');
        
        // Create muzzle flash effect
        const player = this.entities.get('player');
        if (player && player.position) {
            this.createMuzzleFlash(player.position.x, player.position.y, player.rotation);
        }
        
        // Haptic feedback
        if (this.options.hapticFeedback) {
            this.options.audioManager.vibrateShort();
        }
    }

    activatePlayerSpecial() {
        this.options.audioManager.playSound('powerup');
        
        // Create special effect
        const player = this.entities.get('player');
        if (player && player.position) {
            this.createSpecialEffect(player.position.x, player.position.y);
        }
        
        // Haptic feedback
        if (this.options.hapticFeedback) {
            this.options.audioManager.vibrateLong();
        }
    }

    createMuzzleFlash(x, y, rotation) {
        const flashX = x + Math.cos(rotation) * 40;
        const flashY = y + Math.sin(rotation) * 40;
        
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: flashX,
                y: flashY,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                size: Math.random() * 3 + 1,
                color: '#ffff00',
                life: 0.2,
                maxLife: 0.2
            });
        }
    }

    createSpecialEffect(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 300,
                vy: Math.sin(angle) * 300,
                size: Math.random() * 4 + 2,
                color: '#ff00ff',
                life: 0.5,
                maxLife: 0.5
            });
        }
    }

    createExplosion(x, y, size = 1) {
        for (let i = 0; i < 15 * size; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 400 * size,
                vy: (Math.random() - 0.5) * 400 * size,
                size: Math.random() * 5 + 2,
                color: Math.random() > 0.5 ? '#ff4000' : '#ffff00',
                life: 0.8,
                maxLife: 0.8
            });
        }
    }

    handleBotHit(data) {
        const { botId, damage, position } = data;
        const bot = this.entities.get(botId);
        
        if (bot) {
            // Update stats
            if (botId === 'enemy') {
                this.gameStats.hits++;
                this.gameStats.damage += damage;
            }
            
            // Create hit effect
            this.createExplosion(position.x, position.y, 0.5);
            
            // Play sound
            this.options.audioManager.playSound('hit');
            
            // Haptic feedback
            if (this.options.hapticFeedback) {
                this.options.audioManager.vibrate([30, 10, 30]);
            }
        }
    }

    handleProjectileHitWall(data) {
        const { position } = data;
        
        // Create wall hit effect
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: position.x,
                y: position.y,
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                size: Math.random() * 2 + 1,
                color: '#ffffff',
                life: 0.3,
                maxLife: 0.3
            });
        }
    }

    checkGameEnd() {
        const player = this.entities.get('player');
        const enemy = this.entities.get('enemy');
        
        let gameOver = false;
        let victory = false;
        
        // Check health
        if (player && player.health <= 0) {
            gameOver = true;
            victory = false;
        } else if (enemy && enemy.health <= 0) {
            gameOver = true;
            victory = true;
        }
        
        // Check time
        if (this.gameTime >= this.maxGameTime) {
            gameOver = true;
            victory = player && enemy && player.health > enemy.health;
        }
        
        if (gameOver) {
            this.endGame(victory);
        }
    }

    endGame(victory) {
        this.isRunning = false;
        
        const endTime = Date.now();
        const duration = endTime - this.gameStats.startTime;
        const accuracy = this.gameStats.shots > 0 ? Math.round((this.gameStats.hits / this.gameStats.shots) * 100) : 0;
        
        const result = {
            victory,
            time: this.formatTime(duration),
            timeSeconds: duration / 1000,
            damage: this.gameStats.damage,
            accuracy,
            duration
        };
        
        // Play end game sound
        this.options.audioManager.playSound(victory ? 'victory' : 'defeat');
        
        // Emit game over event
        this.emit('gameOver', result);
        
        console.log('Game ended:', result);
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
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
        }
        
        this.emit('pause', this.isPaused);
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    setZoom(zoom) {
        this.camera.zoom = zoom;
    }

    handleResize() {
        this.setupCanvas();
    }

    // Event emitter functionality
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    destroy() {
        this.isRunning = false;
        
        if (this.physics) {
            this.physics.cleanup();
        }
        
        if (this.controls) {
            this.controls.cleanup();
        }
        
        this.entities.clear();
        this.particles = [];
        this.eventListeners = {};
    }
}

