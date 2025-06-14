import System from '../System.js';
import PositionComponent from '../components/PositionComponent.js';
import RenderComponent from '../components/RenderComponent.js';
import HealthComponent from '../components/HealthComponent.js';
import PhysicsComponent from '../components/PhysicsComponent.js';
import EnergyComponent from '../components/EnergyComponent.js';
// For drawMinimap to check entity types for coloring dots
import PlayerControlledComponent from '../components/PlayerControlledComponent.js';
import AIControlledComponent from '../components/AIControlledComponent.js';
// For drawScreenEffects to get EffectComponent
import EffectComponent from '../components/EffectComponent.js';


class RenderSystem extends System {
  constructor(canvasContext, entityManager, camera, gameEngine) {
    super();
    this.ctx = canvasContext;
    this.entityManager = entityManager;
    this.camera = camera;
    this.gameEngine = gameEngine;
    this.imageCache = {}; // Simple image cache
    this.imagePathsToLoad = new Set(); // To collect all unique sprite paths
  }

  // Method to preload images (app.js or GameEngine would call this once)
  async preloadImages() {
    const promises = [];
    for (const path of this.imagePathsToLoad) {
        if (!this.imageCache[path]) {
            promises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.imageCache[path] = img;
                    resolve(img);
                };
                img.onerror = () => {
                    console.warn(`RenderSystem: Failed to load image ${path}`);
                    this.imageCache[path] = null; // Mark as failed to avoid re-trying constantly
                    resolve(null); // Resolve so Promise.all doesn't break
                };
                img.src = path;
            }));
        }
    }
    await Promise.all(promises);
    console.log("RenderSystem: Images preloaded.", this.imageCache);
  }

  getImage(spritePath) {
    if (!spritePath) return null;
    // In a real scenario, if not loaded, this might return a placeholder or trigger loading.
    // For now, assumes preloadImages was called.
    return this.imageCache[spritePath] || null;
  }


  update(allEntities, deltaTime, entityManager, ctx, camera, physicsEngine, controls) {
    // Use the context, camera, and entities passed or those from constructor
    const currentCtx = this.ctx || ctx;
    const currentCamera = this.camera || camera;
    const entitiesToRender = allEntities || this.entityManager.getAllEntities();

    if (!currentCtx || !currentCamera) {
      console.error("RenderSystem: Canvas context or camera not available!");
      return;
    }

    const width = currentCtx.canvas.width / window.devicePixelRatio;
    const height = currentCtx.canvas.height / window.devicePixelRatio;

    // 1. Clear canvas
    currentCtx.clearRect(0, 0, width, height);

    // 2. Save context and apply camera transform
    currentCtx.save();
    currentCtx.translate(width / 2, height / 2);
    currentCtx.scale(currentCamera.zoom, currentCamera.zoom);
    // Use currentX and currentY which include shake effects
    currentCtx.translate(-currentCamera.currentX, -currentCamera.currentY);

    // 3. Draw background (arena, grid, obstacles)
    // This logic is from game.js drawArenaBackground
    this.drawArenaBackground(currentCtx);

    // 4. Sort entities by layer for proper rendering order
    const sortedEntities = [...entitiesToRender].sort((a, b) => {
      const renderA = a.getComponent(RenderComponent);
      const renderB = b.getComponent(RenderComponent);
      return (renderA ? renderA.layer : 0) - (renderB ? renderB.layer : 0);
    });

    // 5. Draw each entity
    for (const entity of sortedEntities) {
      const posComp = entity.getComponent(PositionComponent);
      const renderComp = entity.getComponent(RenderComponent);

      if (posComp && renderComp && renderComp.isVisible) {
        currentCtx.save();

        // Apply animation offsets for translation
        const animX = posComp.x + (renderComp.animationOffsetX || 0);
        const animY = posComp.y + (renderComp.animationOffsetY || 0);
        currentCtx.translate(animX, animY);

        // Apply combined rotation (base + animation offset)
        const totalRotation = (posComp.rotation || 0) + (renderComp.animationRotationOffset || 0);
        currentCtx.rotate(totalRotation);

        // Apply animation scale
        const scale = renderComp.animationScale || 1;
        currentCtx.scale(scale, scale);

        // Handle overall opacity
        if (renderComp.opacity < 1.0) {
            currentCtx.globalAlpha = renderComp.opacity;
        }

        // Handle animation tint
        let originalColor = renderComp.color;
        if (renderComp.animationTintColor) {
            // Option 1: Mix tint with original color (more complex)
            // Option 2: Prioritize tint (simpler for now)
            // For Option 2, if tint is semi-transparent, it will overlay.
            // If fully opaque, it replaces.
            // Let's assume for now animationTintColor is a full color string like 'rgba(255,0,0,0.5)'
            // and we draw it as an overlay or make draw methods aware.
            // Simpler: if tint, use it. If not, use base. This doesn't really "tint" but "replaces".
            // A true tint requires blending or modifying the fillStyle before each draw call.
            // For now, the drawing methods will primarily use renderComp.color,
            // but AnimationSystem might update renderComp.color directly if an animation targets color.
            // OR, we can apply a fill overlay if animationTintColor is set.
        }

        // Drawing logic based on RenderComponent type
        // ParticleSystem updates RenderComponent's color and size for particles.
        // So, generic circle/rectangle drawing should work for them.
        let effectiveColor = renderComp.animationTintColor || renderComp.color;

        if (renderComp.layers && renderComp.layers.length > 0) {
            this.drawLayeredEntity(currentCtx, entity, renderComp);
        } else if (renderComp.spriteName) { // Single sprite entity
            const img = this.getImage(renderComp.spriteName);
            if (img) {
                currentCtx.drawImage(img, -renderComp.size/2, -renderComp.size/2, renderComp.size, renderComp.size);
            } else if (renderComp.shape === 'bot') { // Fallback for bot if sprite fails
                 this.drawBot(currentCtx, entity);
            } else { // Fallback to shape if sprite fails
                 if (renderComp.shape === 'circle') this.drawCircle(currentCtx, 0, 0, renderComp.size, effectiveColor);
                 else if (renderComp.shape === 'rectangle') this.drawRectangle(currentCtx, 0, 0, renderComp.size, renderComp.size, effectiveColor);
            }
        } else if (renderComp.shape === 'bot') { // Legacy bot drawing if no layers/sprite
          this.drawBot(currentCtx, entity);
        } else if (renderComp.shape === 'projectile' || renderComp.shape === 'rectangle_projectile') {
          this.drawProjectile(currentCtx, entity);
        } else if (renderComp.shape === 'circle') {
          this.drawCircle(currentCtx, 0, 0, renderComp.size, effectiveColor);
        } else if (renderComp.shape === 'rectangle') {
          this.drawRectangle(currentCtx, 0, 0, renderComp.size, renderComp.size, effectiveColor);
        }

        currentCtx.globalAlpha = 1.0;
        currentCtx.restore();

        // Draw health bar for entities with HealthComponent (drawn in world space, above entity)
        const healthComp = entity.getComponent(HealthComponent);
        if (healthComp && renderComp.shape === 'bot') { // Only draw for bots, or make configurable
             // Use original non-rotated context for health bar by drawing outside the save/restore block for entity rotation,
             // but it needs to be translated correctly. Or, counter-rotate. Simpler: draw it relative to entity's current pos.
             this.drawHealthBar(currentCtx, posComp, healthComp, renderComp.size);
        }
      }
    }

    // Draw particles - RenderSystem already iterates all entities, so particles with RenderComponent will be drawn.
    // No specific separate loop for particles needed here if they are standard entities.

    // 6. Restore context after all world-space drawing (entities, particles, flares)
    currentCtx.restore();

    // 7. Draw screen-space effects (like screenTint) and UI elements (minimap)
    // These are drawn *after* restoring from camera transform, so they are fixed on screen.
    this.drawScreenEffects(currentCtx, width, height, entitiesToRender);

    // UI elements not affected by camera (e.g., minimap, scores)
    // For now, if gameEngine reference is passed, can call its methods, or better, move drawing here.
    this.drawMinimap(currentCtx, width - 120, 10, 100, 100, entitiesToRender);

    // Update DOM UI elements
    this.updateDOMUI(this.entityManager);
  }

  drawScreenEffects(ctx, screenWidth, screenHeight, allEntities) {
    // Iterate for 'screenTint' effects
    for (const entity of allEntities) {
      const effectComp = entity.getComponent(EffectComponent); // Use static import
      if (effectComp && effectComp.effectType === 'screenTint' && effectComp.isAlive()) {
        ctx.save();
        ctx.fillStyle = effectComp.getCurrentColor();
        ctx.fillRect(0, 0, screenWidth, screenHeight);
        ctx.restore();
      }
    }
  }

  // Method to update DOM elements (migrated from GameEngine.updateUI)
  updateDOMUI(entityManager) {
    const playerEntity = entityManager.getEntityById('player');
    const enemyEntity = entityManager.getEntityById('enemy');

    if (playerEntity) {
        const healthComp = playerEntity.getComponent(HealthComponent);
        const energyComp = playerEntity.getComponent(EnergyComponent);
        const weaponComp = playerEntity.getComponent(require('../components/WeaponComponent')); // Dynamic require

        const playerHealthBar = document.getElementById('player-health');
        const playerHealthText = playerHealthBar ? playerHealthBar.parentElement.querySelector('.health-text') : null;
        if (playerHealthBar && playerHealthText && healthComp) {
            playerHealthBar.style.width = `${(healthComp.currentHealth / healthComp.maxHealth) * 100}%`;
            playerHealthText.textContent = Math.ceil(healthComp.currentHealth);
        }

        const playerEnergyBar = document.getElementById('player-energy');
        if (playerEnergyBar && energyComp) {
            playerEnergyBar.style.width = `${(energyComp.currentEnergy / energyComp.maxEnergy) * 100}%`;
        }

        // Update Weapon/Cooldown UI
        const weaponIconEl = document.getElementById('player-weapon-icon');
        const weaponAmmoEl = document.getElementById('player-weapon-ammo'); // Assuming this exists if ammo is a feature
        const weaponCooldownFillEl = document.querySelector('#player-weapon-cooldown .cooldown-fill');

        if (weaponComp) {
            if (weaponIconEl) {
                // TODO: Set icon based on weaponComp.projectileType or a dedicated weaponName/icon property
                // weaponIconEl.innerHTML = `<img src="icons/${weaponComp.projectileType}.png" alt="${weaponComp.projectileType}">`;
            }
            if (weaponAmmoEl) {
                // TODO: Update ammo if weaponComp has ammo properties (e.g., currentAmmo, maxAmmo)
                // weaponAmmoEl.textContent = `${weaponComp.currentAmmo}/${weaponComp.maxAmmo}`;
            }
            if (weaponCooldownFillEl) {
                const cooldown = 1000 / weaponComp.fireRate; // Cooldown in ms
                const timeSinceLastShot = Date.now() - weaponComp.lastShotTime;
                const cooldownProgress = Math.min(1, timeSinceLastShot / cooldown);
                weaponCooldownFillEl.style.width = `${cooldownProgress * 100}%`;
            }
        }
    }

    if (enemyEntity) {
        const healthComp = enemyEntity.getComponent(HealthComponent);
        const enemyHealthBar = document.getElementById('enemy-health');
        const enemyHealthText = enemyHealthBar ? enemyHealthBar.parentElement.querySelector('.health-text') : null;
        if (enemyHealthBar && enemyHealthText && healthComp) {
            enemyHealthBar.style.width = `${(healthComp.currentHealth / healthComp.maxHealth) * 100}%`;
            enemyHealthText.textContent = Math.ceil(healthComp.currentHealth);
        }
    }

    // Game Timer update can also be part of this (if GameEngine's gameTime is accessible or passed)
    // For now, GameEngine.updateGameTimer still handles the timer DOM element.

    // Display Countdown Message
    const countdownEl = document.getElementById('countdown-message');
    if (countdownEl && this.gameEngine) { // Check if gameEngine ref exists
      if (this.gameEngine.countdownMessage) {
        countdownEl.textContent = this.gameEngine.countdownMessage;
        countdownEl.classList.add('visible');
      } else {
        countdownEl.classList.remove('visible');
      }
    }

    // Display Post-Game Message
    const postGameEl = document.getElementById('post-game-message');
    if (postGameEl && this.gameEngine) {
      if (this.gameEngine.showingPostGameMessage && this.gameEngine.postGameMessage) {
        postGameEl.textContent = this.gameEngine.postGameMessage;
        postGameEl.classList.add('visible');
        if (this.gameEngine.postGameMessage === "VICTORY!") {
            postGameEl.className = 'game-message overlay-message visible victory';
        } else {
            postGameEl.className = 'game-message overlay-message visible defeat';
        }
      } else {
        postGameEl.classList.remove('visible');
      }
    }
  }


  // --- Drawing Helper Methods (migrated from GameEngine) ---

  // Method to set current map display properties
  setMap(mapData) {
    this.mapDimensions = mapData.dimensions;
    this.mapBackgroundInfo = mapData.background;
    // Collect all sprite paths from map background layers for preloading
    if (this.mapBackgroundInfo && this.mapBackgroundInfo.layers) {
        this.mapBackgroundInfo.layers.forEach(layer => {
            if (layer.imagePath) this.imagePathsToLoad.add(layer.imagePath);
        });
    }
    // TODO: Trigger preloading if not already done, or if new paths added.
    // This might be better handled in GameEngine.loadLevel by calling a specific
    // method in RenderSystem to register map sprites, then calling preloadImages.
  }

  drawLayeredEntity(ctx, entity, renderComp) {
    // Sort layers by their zOrderOffset if it exists, otherwise draw in order
    const sortedLayers = [...renderComp.layers].sort((a,b) => (a.zOrderOffset || 0) - (b.zOrderOffset || 0));

    for (const layer of sortedLayers) {
        if (!layer.sprite) continue;
        const img = this.getImage(layer.sprite);
        if (!img) {
            // console.warn(`Sprite not found or loaded for layer: ${layer.sprite}`);
            // Optionally draw a placeholder shape if image fails to load
            const placeholderColor = layer.color || renderComp.color || 'grey';
            const layerWidth = layer.width || renderComp.size;
            const layerHeight = layer.height || renderComp.size;
            ctx.save();
            ctx.translate(layer.offsetX || 0, layer.offsetY || 0);
            ctx.rotate(layer.rotation || 0);
            this.drawRectangle(ctx, 0, 0, layerWidth, layerHeight, placeholderColor);
            ctx.restore();
            continue;
        }

        ctx.save();
        // Apply layer-specific transformations (offsets are relative to entity's main transform)
        ctx.translate(layer.offsetX || 0, layer.offsetY || 0);
        ctx.rotate(layer.rotation || 0);

        const layerWidth = layer.width || img.width; // Use specified width or image natural width
        const layerHeight = layer.height || img.height; // Use specified height or image natural height

        // Draw the image centered on its local origin (offsetX/Y is already applied)
        ctx.drawImage(img, -layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight);

        // TODO: Apply layer-specific tint if layer.color is set and different from main tint/color
        // This might involve setting globalCompositeOperation or drawing a tinted rect over the sprite.

        ctx.restore();
    }
    // After drawing layers, one might draw additional effects like shield, specific to the bot entity
    // These would be part of the drawBot logic if it's called for layered entities too,
    // or integrated here if drawBot is fully replaced by drawLayeredEntity for bots.
    const physicsComp = entity.getComponent(PhysicsComponent);
    const energyComp = entity.getComponent(EnergyComponent);
    if (renderComp.shape === 'bot') { // Assuming 'bot' shape implies bot-specific effects like shield/energy glow
        this.drawBotEffects(ctx, renderComp, physicsComp, energyComp);
    }
  }

  // Extracted from drawBot for reuse if drawBot is replaced by drawLayeredEntity
  drawBotEffects(ctx, renderComp, physicsComp, energyComp) {
    const size = renderComp.size || 30; // Base size for effect scaling
    const effectColor = renderComp.animationTintColor || renderComp.color || '#00ffff';

    if (physicsComp && physicsComp.body && physicsComp.body.userData && physicsComp.body.userData.shields) {
      ctx.save();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size + 15, 0, Math.PI * 2); // Shield drawn around the center
      ctx.stroke();
      ctx.restore();
    }

    if (energyComp && energyComp.currentEnergy > energyComp.maxEnergy * 0.5) {
      ctx.save();
      ctx.shadowColor = effectColor;
      ctx.shadowBlur = 10 + (energyComp.currentEnergy / energyComp.maxEnergy) * 10;
      ctx.strokeStyle = effectColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, size + 5, 0, Math.PI * 2); // Energy glow around the center
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }


  drawArenaBackground(ctx) {
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(-1000, -1000, 2000, 2000);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 100;
    for (let x = -1000; x <= 1000; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, -1000); ctx.lineTo(x, 1000); ctx.stroke();
    }
    for (let y = -1000; y <= 1000; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(-1000, y); ctx.lineTo(1000, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    const obstacles = [ /* TODO: Make obstacles entities or load from map data */
      { x: 200, y: 200, width: 100, height: 100 }, { x: -200, y: -200, width: 100, height: 100 },
      { x: 300, y: -300, width: 80, height: 150 }, { x: -400, y: 100, width: 120, height: 80 }
    ];
    obstacles.forEach(o => {
      ctx.fillRect(o.x - o.width/2, o.y - o.height/2, o.width, o.height);
      ctx.strokeRect(o.x - o.width/2, o.y - o.height/2, o.width, o.height);
    });
  }

  drawBot(ctx, entity) {
    const renderComp = entity.getComponent(RenderComponent);
    const physicsComp = entity.getComponent(PhysicsComponent);
    const energyComp = entity.getComponent(EnergyComponent);

    const size = renderComp.size || 30;
    // Use animationTintColor if available, otherwise default to component's color
    const baseColor = renderComp.animationTintColor || renderComp.color || '#00ffff';

    // If animationTintColor is RGBA, use it directly. If it's a hex or named color without alpha, append one.
    // For simplicity, assume animationTintColor comes with alpha or drawBot applies a default one for fill.
    let fillColor = baseColor;
    if (typeof baseColor === 'string' && baseColor.startsWith('#')) { // Basic hex check
        fillColor = baseColor + '40'; // Append default alpha for fill if hex
    } else if (typeof baseColor === 'string' && !baseColor.startsWith('rgba')) {
        // For named colors or RGB, fillStyle can handle it, but for consistency with hex:
        // This part might need a small color utility if complex color manipulations are needed.
        // For now, if it's an rgba string from animationTintColor, it's used as is.
        // If it's a simple color name from renderComp.color, we might want to add default alpha.
        // Let's assume `animationTintColor` is RGBA, and `renderComp.color` is base (no alpha for stroke).
        if (!renderComp.animationTintColor && !baseColor.startsWith('rgba')) {
             fillColor = baseColor + '40'; // Default alpha for base color fill
        }
    }


    ctx.fillStyle = fillColor;
    ctx.strokeStyle = renderComp.animationTintColor ? baseColor : renderComp.color || '#00ffff'; // Stroke with non-alpha part of tint or base color
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-size, -size, size * 2, size * 2, 8);
    ctx.fill();
    ctx.stroke();

    // Direction indicator
    ctx.strokeStyle = renderComp.animationTintColor ? baseColor : renderComp.color || '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size + 10, 0);
    ctx.stroke();

    // Shield effect
    if (physicsComp && physicsComp.body && physicsComp.body.userData && physicsComp.body.userData.shields) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Energy glow
    if (energyComp && energyComp.currentEnergy > energyComp.maxEnergy * 0.5) {
      const glowColor = renderComp.animationTintColor || renderComp.color || '#00ffff';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10 + (energyComp.currentEnergy / energyComp.maxEnergy) * 10;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }

  drawProjectile(ctx, entity) {
    const renderComp = entity.getComponent(RenderComponent);
    const effectiveColor = renderComp.animationTintColor || renderComp.color || '#ffff00';
    const size = renderComp.size || 3;

    ctx.fillStyle = effectiveColor;
    ctx.shadowColor = renderComp.glowColor || effectiveColor;
    ctx.shadowBlur = renderComp.glowSize || 8;

    ctx.beginPath();
    if (renderComp.shape === 'rectangle_projectile') {
        ctx.fillRect(-size/2, -size/4, size, size/2);
    } else {
        ctx.arc(0, 0, size, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Optional: Draw a simple trail
    // if (velComp && (velComp.vx !== 0 || velComp.vy !== 0)) {
    //   const trailLength = 10;
    //   ctx.strokeStyle = renderComp.trailColor || color + '80'; // Semi-transparent
    //   ctx.lineWidth = size * 0.5; // Trail thinner than projectile
    //   ctx.beginPath();
    //   // Projectile's (0,0) is its current position. We draw a line "behind" it.
    //   // This requires knowing its previous position or drawing based on inverted velocity.
    //   // Simplified: draw a line pointing opposite to its orientation if available
    //   // Or, if PositionComponent stores previous x,y, use that.
    //   // For now, this part is complex without more state and is better handled by particles.
    //   // ctx.moveTo(0, 0);
    //   // ctx.lineTo(-velComp.vx * deltaTime * trailLengthFactor, -velComp.vy * deltaTime * trailLengthFactor);
    //   ctx.stroke();
    // }
  }

  drawCircle(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  }

  drawRectangle(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
  }

  drawHealthBar(ctx, posComp, healthComp, entitySize) {
    if (healthComp.currentHealth >= healthComp.maxHealth) return;

    const barWidth = Math.max(30, (entitySize || 30) * 1.5); // Added default for entitySize
    const barHeight = 4;
    const x = posComp.x - barWidth / 2;
    const y = posComp.y - (entitySize || 30) - 10;

    ctx.save();
    // Health bars are drawn in world space relative to entity, so they are already affected by camera.
    // No need to reset and re-apply camera transforms here if called within the main entity loop's save/restore.
    // However, if called from main render after world transforms are popped, then yes.
    // The current structure calls it inside the entity loop's save/restore, but health bar should not rotate.
    // So, we need to counter the entity's rotation OR draw it outside that specific save/restore.
    // The provided code structure for health bar drawing *after* entity restore implies it's drawn outside the entity's own rotation.
    // Let's assume it's called where ctx is already in world space, but we need to draw it unrotated.
    // The save/restore here is for health bar specific styles.

    // Background
    ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Health fill
    const healthPercent = healthComp.currentHealth / healthComp.maxHealth;
    const healthColor = healthPercent > 0.6 ? '#4CAF50' : healthPercent > 0.3 ? '#FFC107' : '#F44336';
    ctx.fillStyle = healthColor;
    ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
    ctx.restore();
  }

  // drawMinimap from GameEngine (needs to be adapted for RenderSystem context)
  drawMinimap(ctx, x, y, width, height, entities) { // Pass entities for minimap
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    const scale = width / 2000; // Arena is 2000x2000 (hardcoded for now)

    ctx.translate(x + width/2, y + height/2);
    ctx.scale(scale, scale);

    entities.forEach(entity => {
        const posComp = entity.getComponent(PositionComponent);
        const renderComp = entity.getComponent(RenderComponent);
        if (posComp && renderComp) {
            let color = '#888888';
            if (renderComp.shape === 'bot') {
                if (entity.hasComponent(PlayerControlledComponent)) {
                    color = '#00ffff';
                } else if (entity.hasComponent(AIControlledComponent)) {
                    color = '#ff0040';
                }
            }
            ctx.fillStyle = color;
            ctx.beginPath();
            // Use a larger size for minimap dots for visibility
            ctx.arc(posComp.x, posComp.y, 20 / scale, 0, Math.PI * 2); // Scale dot size inversely
            ctx.fill();
        }
    });
    ctx.restore();
  }
}

export default RenderSystem;
