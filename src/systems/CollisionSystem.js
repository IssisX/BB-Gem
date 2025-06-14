const System = require('../System');
const HealthComponent = require('../components/HealthComponent');
const PhysicsComponent = require('../components/PhysicsComponent');
const ProjectileComponent = require('../components/ProjectileComponent');
const PlayerControlledComponent = require('../components/PlayerControlledComponent');
const AIControlledComponent = require('../components/AIControlledComponent');
const PositionComponent = require('../components/PositionComponent');
const AnimationComponent = require('../components/AnimationComponent'); // Import AnimationComponent

class CollisionSystem extends System {
  constructor(physicsEngine, entityManager, particleSystem, effectSystem) { // Added effectSystem from game.js
    super();
    this.physicsEngine = physicsEngine;
    this.entityManager = entityManager;
    this.particleSystem = particleSystem;
    this.effectSystem = effectSystem;
    this.gameEngine = null;
    // this.hapticsEnabled = () => this.gameEngine && this.gameEngine.options && this.gameEngine.options.hapticFeedback;


    if (this.physicsEngine && this.physicsEngine.world && typeof this.physicsEngine.world.on === 'function') {
      this.physicsEngine.world.on('beginContact', this.handleCannonCollision.bind(this));
      // console.log('CollisionSystem: Successfully subscribed to beginContact events.');
    } else {
      console.error('CollisionSystem: Physics engine or world not available for event subscription.');
    }
  }

  handleCannonCollision(event) {
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;

    // Ensure userData exists and has entityId
    if (!bodyA.userData || !bodyA.userData.entityId || !bodyB.userData || !bodyB.userData.entityId) {
        // console.warn("CollisionSystem: Collision involved body with no entityId in userData.", bodyA.userData, bodyB.userData);
        return;
    }

    const entityA = this.entityManager.getEntityById(bodyA.userData.entityId);
    const entityB = this.entityManager.getEntityById(bodyB.userData.entityId);

    if (entityA && entityB) {
      this.processCollision(entityA, entityB, event);
    } else {
      // console.warn("CollisionSystem: Could not find one or both entities for collision.", bodyA.userData.entityId, bodyB.userData.entityId);
    }
  }

  // Call this from GameEngine after all systems are initialized if direct gameEngine reference is needed
  // Or, GameEngine instance can be passed in update() method.
  setGameEngine(gameEngine) {
    this.gameEngine = gameEngine;
  }

  processCollision(entityA, entityB, cannonEvent) {
    if (!entityA || !entityB || entityA.id === entityB.id) return;

    const projectileCompA = entityA.getComponent(ProjectileComponent);
    const projectileCompB = entityB.getComponent(ProjectileComponent);

    let projectileEntity = null;
    let targetEntity = null;

    if (projectileCompA && !projectileCompB) { // Entity A is projectile, B is target
      projectileEntity = entityA;
      targetEntity = entityB;
    } else if (!projectileCompA && projectileCompB) { // Entity B is projectile, A is target
      projectileEntity = entityB;
      targetEntity = entityA;
    } else if (projectileCompA && projectileCompB) {
      // Projectile-projectile collision, ignore for now or handle if needed
      return;
    } else {
      // Bot-bot or Bot-environment collision, handle if needed (e.g. small bounce damage)
      // console.log(`Non-projectile collision: ${entityA.id} vs ${entityB.id}`);
      return;
    }

    const healthComp = targetEntity.getComponent(HealthComponent);
    const projComp = projectileEntity.getComponent(ProjectileComponent); // Re-get for clarity

    if (healthComp && projComp) {
      // Check if this projectile has already hit this target (for multi-contact point scenarios)
      if (projComp.hasHit(targetEntity.id)) {
        return;
      }
      projComp.recordHit(targetEntity.id);

      healthComp.takeDamage(projComp.damage);
      // console.log(`Entity ${targetEntity.id} took ${projComp.damage} damage. Health: ${healthComp.currentHealth}`);

      // Trigger hit animation on the target
      const targetAnimComp = targetEntity.getComponent(AnimationComponent);
      if (targetAnimComp) {
        targetAnimComp.play('hitReact', true);
      }

      let hitPosition = targetEntity.getComponent(PositionComponent) || projectileEntity.getComponent(PositionComponent);
      if (projectileEntity.getComponent(PositionComponent)) {
          hitPosition = projectileEntity.getComponent(PositionComponent);
      }

      // Haptic feedback if the target is the player
      if (targetEntity.hasComponent(PlayerControlledComponent) && this._hapticsEnabled() && navigator.vibrate) {
        navigator.vibrate(75); // Medium buzz for player taking damage
      }

      // Trigger particle and screen effects
      if (hitPosition) {
        if (projComp.damage > 15) {
          if (this.particleSystem) {
            const direction = { x: cannonEvent.contact.ni.x * -1, y: cannonEvent.contact.ni.z * -1 };
            this.particleSystem.createEffect('sparks', hitPosition.x, hitPosition.y, 15, { direction: direction, spreadAngle: Math.PI / 3, scale: 0.8 });
          }
          if (this.effectSystem) {
              this.effectSystem.createExplosionLightFlash(0.15, [255,255,255,0.2], 0.2);
          }
          if (this.gameEngine) {
              this.gameEngine.triggerScreenShake(projComp.damage / 2, 0.15);
              if (projComp.damage > 20) {
                this.gameEngine.triggerHitStop(80);
              }
          }
        } else {
          if (this.particleSystem) this.particleSystem.createEffect('hit', hitPosition.x, hitPosition.y, 10, { color: [200, 200, 200, 1], scale: 0.7 });
          if (this.gameEngine) this.gameEngine.triggerScreenShake(projComp.damage / 3, 0.1);
        }
      }

      // Remove projectile entity after impact
      this.entityManager.removeEntity(projectileEntity.id);
      // Also remove its physics body from the world
      const projectilePhysicsComp = projectileEntity.getComponent(PhysicsComponent);
      if (projectilePhysicsComp && projectilePhysicsComp.body) {
        this.physicsEngine.world.removeBody(projectilePhysicsComp.body);
      }
    }
  }

  // Helper for haptics, assuming gameEngine is available
  _hapticsEnabled() {
    return this.gameEngine && this.gameEngine.options && this.gameEngine.options.hapticFeedback;
  }

  update(entities, deltaTime, entityManager, ctx, camera, physicsEngine, controls, particleSystem, effectSystem, gameEngineRef) {
    if (gameEngineRef && !this.gameEngine) { // Store gameEngine reference if passed in update
        this.gameEngine = gameEngineRef;
    }
    this.particleSystem = this.particleSystem || particleSystem; // Fallback
    this.effectSystem = this.effectSystem || effectSystem;     // Fallback


    for (const entity of entities) {
        const projComp = entity.getComponent(ProjectileComponent);
        if (projComp && projComp.isExpired()) {
            this.entityManager.removeEntity(entity.id);
            const physicsComp = entity.getComponent(PhysicsComponent);
            if (physicsComp && physicsComp.body) {
                (this.physicsEngine || physicsEngine).world.removeBody(physicsComp.body);
            }
        }
    }
  }
}

module.exports = CollisionSystem;
