const System = require('../System');
const ParticleComponent = require('../components/ParticleComponent');
const PositionComponent = require('../components/PositionComponent');
const VelocityComponent = require('../components/VelocityComponent');
const RenderComponent = require('../components/RenderComponent');

const GRAVITY_Y = 98.2 * 1;

class ParticleSystem extends System {
  constructor(entityManager, options = {}, effectSystem = null) { // Added effectSystem
    super();
    this.entityManager = entityManager;
    this.options = options;
    this.qualitySetting = this.options.particleQuality || 'high';
    this.effectSystem = effectSystem; // Store EffectSystem instance
  }

  getAdjustedCount(baseCount) {
    if (this.qualitySetting === 'low') {
      return Math.floor(baseCount / 3) || 1; // Ensure at least 1 particle if baseCount > 0
    } else if (this.qualitySetting === 'medium') {
      return Math.floor(baseCount / 2) || 1;
    }
    return baseCount; // 'high' or undefined uses baseCount
  }

  createEffect(type, x, y, count = 10, options = {}) {
    const adjustedCount = this.getAdjustedCount(count);
    if (adjustedCount === 0 && count > 0) { // If original count was >0, but adjusted is 0, maybe spawn 1 still
        // This logic is now in getAdjustedCount, but as a fallback:
        // if (count > 0) adjustedCount = 1; else return;
    } else if (adjustedCount === 0) {
        return; // Don't create zero particles if base count was zero or adjustment made it zero.
    }


    switch (type) {
      case 'explosion':
        this.createExplosion(x, y, adjustedCount, options);
        break;
      case 'muzzleFlash':
        this.createMuzzleFlash(x, y, options.rotation || 0, adjustedCount, options);
        break;
      case 'hit':
        this.createHitEffect(x, y, adjustedCount, options.color || [255,255,255,1], options);
        break;
      case 'debrisExplosion':
        this.createDebrisExplosion(x, y, adjustedCount, options);
        break;
      case 'sparks':
        this.createSparks(x, y, adjustedCount, options.direction || {x:1, y:0}, options.spreadAngle || Math.PI/4, options);
        break;
      case 'smokePlume':
        this.createSmokePlume(x, y, adjustedCount, options);
        break;
    }
  }

  createExplosion(x, y, particleCount = 20, effectOptions = {}) {
    for (let i = 0; i < particleCount; i++) {
      const particleEntity = this.entityManager.createEntity();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 150 + 80) * (effectOptions.scale || 1);
      const life = Math.random() * 0.7 + 0.5;

      particleEntity.addComponent(new PositionComponent(x, y));
      particleEntity.addComponent(new VelocityComponent(Math.cos(angle) * speed, Math.sin(angle) * speed));

      const startSize = (Math.random() * 5 + 4) * (effectOptions.scale || 1);
      const r = Math.random() > 0.6 ? 255 : 220;
      const g = Math.random() > 0.4 ? 180 : 80;

      particleEntity.addComponent(new ParticleComponent({
        life: life, maxLife: life,
        startSize: startSize, endSize: 0.5,
        startColor: [r, g, 30, 1],
        endColor: [150, 50, 0, 0],
        gravityEffect: 0.1,
        friction: 0.02,
        angularVelocity: (Math.random() - 0.5) * 2,
      }));
      particleEntity.addComponent(new RenderComponent('circle', `rgba(${r},${g},30,1)`, null, true, 3, startSize));
    }
    if (effectOptions.smoke !== false && this.qualitySetting !== 'low') {
        this.createSmokePlume(x,y, this.getAdjustedCount(Math.floor(particleCount / 2)), { initialDelay: 0.1, scale: effectOptions.scale });
    }
    // Create light flash effect for explosion
    if (this.effectSystem && effectOptions.lightFlash !== false) {
      this.effectSystem.createExplosionLightFlash(0.3, [255,235,200,0.25], 0.25); // duration, color, startOpacity
    }
  }

  createMuzzleFlash(x, y, rotation, particleCount = 8, effectOptions = {}) {
    // Create illumination effect
    if (this.effectSystem && effectOptions.illumination !== false) {
        // Spawn the flare slightly in front of the muzzle, along the rotation
        const flareSpawnDistance = (effectOptions.spawnDistance || 5) + 10;
        const flareX = x + Math.cos(rotation) * flareSpawnDistance;
        const flareY = y + Math.sin(rotation) * flareSpawnDistance;
        this.effectSystem.createMuzzleFlashIllumination(flareX, flareY, (effectOptions.scale || 1) * 80, 0.1);
    }

    const baseAngle = rotation;
    for (let i = 0; i < particleCount; i++) {
      const particleEntity = this.entityManager.createEntity();
      const angleOffset = (Math.random() - 0.5) * (Math.PI / 6);
      const angle = baseAngle + angleOffset;
      const speed = Math.random() * 200 + 150;
      const life = Math.random() * 0.1 + 0.03;

      const flashSpawnDistance = effectOptions.spawnDistance || 5;
      const spawnX = x + Math.cos(baseAngle) * flashSpawnDistance;
      const spawnY = y + Math.sin(baseAngle) * flashSpawnDistance;

      particleEntity.addComponent(new PositionComponent(spawnX, spawnY));
      particleEntity.addComponent(new VelocityComponent(Math.cos(angle) * speed, Math.sin(angle) * speed));

      const size = (Math.random() * 3 + 2) * (effectOptions.scale || 1);
      particleEntity.addComponent(new ParticleComponent({
        life: life, maxLife: life,
        startSize: size, endSize: size * 0.2,
        startColor: [255, 255, 200, 0.95],
        endColor: [255, 220, 100, 0.1],
        friction: 0.01,
      }));
      particleEntity.addComponent(new RenderComponent('circle', 'rgba(255,255,200,0.95)', null, true, 4, size));
    }
  }

  createHitEffect(x, y, particleCount = 5, color = [255,255,255,1], effectOptions = {}) {
    for (let i = 0; i < particleCount; i++) {
        const particleEntity = this.entityManager.createEntity();
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 80 + 30) * (effectOptions.scale || 1);
        const life = Math.random() * 0.25 + 0.1;
        const size = (Math.random() * 2 + 1.5) * (effectOptions.scale || 1);

        particleEntity.addComponent(new PositionComponent(x, y));
        particleEntity.addComponent(new VelocityComponent(Math.cos(angle) * speed, Math.sin(angle) * speed));
        particleEntity.addComponent(new ParticleComponent({
            life: life, maxLife: life,
            startSize: size, endSize: 0,
            startColor: [...color.slice(0,3), Math.min(1, color[3] * 0.9 || 0.9)],
            endColor: [...color.slice(0,3), 0],
            friction: 0.05,
            gravityEffect: 0.2,
        }));
        particleEntity.addComponent(new RenderComponent('circle', `rgba(${color.join(',')})`, null, true, 3, size));
    }
  }

  createDebrisExplosion(x, y, particleCount = 15, effectOptions = {}) {
    for (let i = 0; i < particleCount; i++) {
      const particleEntity = this.entityManager.createEntity();
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 100 + 40) * (effectOptions.scale || 1);
      const life = Math.random() * 1.0 + 0.5;

      particleEntity.addComponent(new PositionComponent(x, y));
      particleEntity.addComponent(new VelocityComponent(Math.cos(angle) * speed, Math.sin(angle) * speed));

      const size = (Math.random() * 4 + 2) * (effectOptions.scale || 1);
      const greyTone = Math.random() * 50 + 50;
      particleEntity.addComponent(new ParticleComponent({
        life: life, maxLife: life,
        startSize: size, endSize: size * 0.8,
        startColor: [greyTone, greyTone, greyTone, 1],
        endColor: [greyTone - 20, greyTone - 20, greyTone - 20, 0.5],
        gravityEffect: 0.6,
        friction: 0.03,
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 4,
      }));
      particleEntity.addComponent(new RenderComponent('rectangle', `rgb(${greyTone},${greyTone},${greyTone})`, null, true, 2, size));
    }
  }

  createSparks(x, y, particleCount = 25, direction = {x:1, y:0}, spreadAngle = Math.PI/4, effectOptions = {}) {
    const baseAngle = Math.atan2(direction.y, direction.x);
    for (let i = 0; i < particleCount; i++) {
      const particleEntity = this.entityManager.createEntity();
      const angle = baseAngle + (Math.random() - 0.5) * spreadAngle;
      const speed = (Math.random() * 250 + 100) * (effectOptions.scale || 1);
      const life = Math.random() * 0.4 + 0.1;

      particleEntity.addComponent(new PositionComponent(x, y));
      particleEntity.addComponent(new VelocityComponent(Math.cos(angle) * speed, Math.sin(angle) * speed));

      const size = (Math.random() * 2 + 0.5) * (effectOptions.scale || 1);
      particleEntity.addComponent(new ParticleComponent({
        life: life, maxLife: life,
        startSize: size, endSize: 0,
        startColor: [255, 220, 100, 1],
        endColor: [255, 100, 0, 0.5],
        gravityEffect: 0.3,
        friction: 0.01,
      }));
      particleEntity.addComponent(new RenderComponent('circle', 'rgb(255,220,100)', null, true, 4, size));
    }
  }

  createSmokePlume(x, y, particleCount = 10, effectOptions = {}) {
     const delay = (effectOptions.initialDelay || 0) * 1000;
     if (delay > 0) {
        setTimeout(() => this._createSmokeParticles(x,y,particleCount,effectOptions), delay);
     } else {
        this._createSmokeParticles(x,y,particleCount,effectOptions);
     }
  }

  _createSmokeParticles(x, y, particleCount = 10, effectOptions = {}) { // Internal method after delay
    for (let i = 0; i < particleCount; i++) {
      const particleEntity = this.entityManager.createEntity();
      const angle = Math.random() * Math.PI * 2;
      const initialSpeed = (Math.random() * 20 + 5) * (effectOptions.scale || 1);
      const life = Math.random() * 1.5 + 1.0;

      particleEntity.addComponent(new PositionComponent(x + (Math.random()-0.5)*10, y + (Math.random()-0.5)*10));
      particleEntity.addComponent(new VelocityComponent(
        Math.cos(angle) * initialSpeed,
        Math.sin(angle) * initialSpeed - (Math.random() * 20 + 10)
      ));

      const startSize = (Math.random() * 10 + 10) * (effectOptions.scale || 1);
      const endSize = startSize * (Math.random() * 2 + 1.5);
      const greyTone = Math.random() * 50 + 100;
      particleEntity.addComponent(new ParticleComponent({
        life: life, maxLife: life,
        startSize: startSize, endSize: endSize,
        startColor: [greyTone, greyTone, greyTone, 0.6],
        endColor: [greyTone + 50, greyTone + 50, greyTone + 50, 0],
        gravityEffect: -0.2,
        friction: 0.01,
        angularVelocity: (Math.random() - 0.5) * 0.5,
      }));
      particleEntity.addComponent(new RenderComponent('circle', `rgba(${greyTone},${greyTone},${greyTone},0.6)`, null, true, 1, startSize));
    }
  }

  update(entities, deltaTime, entityManager) {
    const currentEntityManager = entityManager || this.entityManager;
    const particlesToRemove = [];

    for (const entity of entities) {
      const particleComp = entity.getComponent(ParticleComponent);
      if (!particleComp) continue;

      particleComp.update(deltaTime);

      if (!particleComp.isAlive()) {
        particlesToRemove.push(entity.id);
        continue;
      }

      const posComp = entity.getComponent(PositionComponent);
      const velComp = entity.getComponent(VelocityComponent);
      if (posComp && velComp) {
        velComp.vy += GRAVITY_Y * particleComp.gravityEffect * deltaTime;

        const frictionFactor = 1 - (particleComp.friction * 60 * deltaTime);
        velComp.vx *= frictionFactor > 0 ? frictionFactor : 0;
        velComp.vy *= frictionFactor > 0 ? frictionFactor : 0;

        posComp.x += velComp.vx * deltaTime;
        posComp.y += velComp.vy * deltaTime;
        posComp.rotation = particleComp.rotation;
      }

      const renderComp = entity.getComponent(RenderComponent);
      if (renderComp) {
        renderComp.color = particleComp.getCurrentColor();
        renderComp.size = particleComp.getCurrentSize();
      }
    }

    for (const entityId of particlesToRemove) {
      currentEntityManager.removeEntity(entityId);
    }
  }
}

module.exports = ParticleSystem;
