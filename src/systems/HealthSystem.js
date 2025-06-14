const System = require('../System');
const HealthComponent = require('../components/HealthComponent');
const PositionComponent = require('../components/PositionComponent'); // For effects on death
const PhysicsComponent = require('../components/PhysicsComponent'); // To remove physics body on death

class HealthSystem extends System {
  constructor(entityManager, particleSystem) {
    super();
    this.entityManager = entityManager;
    this.particleSystem = particleSystem;
    this.effectSystem = effectSystem; // Can be set by constructor or setter too
    this.gameEngine = null;
  }

  // Helper for haptics, assuming gameEngine is available
  _hapticsEnabled() {
    return this.gameEngine && this.gameEngine.options && this.gameEngine.options.hapticFeedback;
  }


  update(entities, deltaTime, entityManager, ctx, camera, physicsEngine, controls, particleSystem, effectSystem, gameEngineRef) {
    const currentEntityManager = entityManager || this.entityManager;
    const currentPhysicsEngine = physicsEngine;
    const currentParticleSystem = particleSystem || this.particleSystem;
    const currentEffectSystem = effectSystem || this.effectSystem;
    const currentGameEngine = gameEngineRef || this.gameEngine;

    // Ensure gameEngine reference is stored if passed for the first time
    if (currentGameEngine && !this.gameEngine) {
        this.gameEngine = currentGameEngine;
    }
    if (currentEffectSystem && !this.effectSystem) {
        this.effectSystem = currentEffectSystem;
    }


    if (!currentEntityManager) {
      console.error("HealthSystem: EntityManager not available!");
      return;
    }

    const entitiesToRemove = [];

    for (const entity of entities) {
      const healthComp = entity.getComponent(HealthComponent);

      if (healthComp) {
        if (!healthComp.isAlive()) {
          // console.log(`Entity ${entity.id.toString()} has died.`);

          const posComp = entity.getComponent(PositionComponent);
          if (posComp) {
            if (currentParticleSystem) {
              currentParticleSystem.createEffect('debrisExplosion', posComp.x, posComp.y, 15, { scale: 1.2 });
              currentParticleSystem.createEffect('smokePlume', posComp.x, posComp.y, 10, { scale: 1.2, initialDelay: 0.2 });
              currentParticleSystem.createEffect('explosion', posComp.x, posComp.y, 25, { scale: 1.0 });
            }
            if (currentEffectSystem) { // Screen flash on death
                currentEffectSystem.createExplosionLightFlash(0.4, [255,255,220,0.3], 0.3);
            }
          }

          // Trigger slow-motion if a significant entity (e.g., player or enemy bot) dies
          const isPlayerEntity = entity.hasComponent(require('../components/PlayerControlledComponent'));
          if (currentGameEngine && (isPlayerEntity || entity.hasComponent(require('../components/AIControlledComponent')))) {
            currentGameEngine.triggerSlowMotion(0.4, 1500);
            currentGameEngine.triggerScreenShake(15, 0.5);
            if (isPlayerEntity && this._hapticsEnabled() && navigator.vibrate) {
              navigator.vibrate([100, 50, 100, 50, 100]); // Strong pattern for player destruction
            }
          }

          entitiesToRemove.push(entity);

        } else {
          // Optional: Low health effects can be triggered here
          // e.g., if (healthComp.currentHealth < healthComp.maxHealth * 0.2) { /* add LowHealthEffectComponent */ }
        }
      }
    }

    // Remove dead entities
    for (const entity of entitiesToRemove) {
      // Remove physics body if it exists
      const physicsComp = entity.getComponent(PhysicsComponent);
      if (physicsComp && physicsComp.body && currentPhysicsEngine && currentPhysicsEngine.world) {
        currentPhysicsEngine.world.removeBody(physicsComp.body);
      }
      currentEntityManager.removeEntity(entity.id); // Use ID for removal
    }
  }
}

module.exports = HealthSystem;
