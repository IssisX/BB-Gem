const System = require('../System');
const AIControlledComponent = require('../components/AIControlledComponent');
const PositionComponent = require('../components/PositionComponent');
const VelocityComponent = require('../components/VelocityComponent');
const WeaponComponent = require('../components/WeaponComponent');
const EnergyComponent = require('../components/EnergyComponent');
const PlayerControlledComponent = require('../components/PlayerControlledComponent');
const RenderComponent = require('../components/RenderComponent');
const PhysicsComponent = require('../components/PhysicsComponent');
const ProjectileComponent = require('../components/ProjectileComponent');
const AnimationComponent = require('../components/AnimationComponent'); // Import AnimationComponent
const CANNON = require('cannon-es');

class AISystem extends System {
  constructor(entityManager) {
    super();
    this.entityManagerInstance = entityManager;
  }

  update(entities, deltaTime, entityManager, ctx, camera, physicsEngine, controls, particleSystem) { // Added particleSystem
    const manager = entityManager || this.entityManagerInstance;
    if (!manager || !physicsEngine || !particleSystem) { // Added particleSystem to check
      console.error("AISystem: EntityManager, PhysicsEngine, or ParticleSystem not available!");
      return;
    }

    let playerTargets = manager.getEntitiesWithComponents([PlayerControlledComponent, PositionComponent]);

    for (const entity of entities) {
      const aiComp = entity.getComponent(AIControlledComponent);
      if (!aiComp) continue;

      const posComp = entity.getComponent(PositionComponent);
      const velocityComp = entity.getComponent(VelocityComponent);
      const weaponComp = entity.getComponent(WeaponComponent);
      const energyComp = entity.getComponent(EnergyComponent);
      const physicsComp = entity.getComponent(PhysicsComponent);

      if (!posComp || !physicsComp || !physicsComp.body) continue; // VelocityComponent might be removed or become read-only for AI too

      let currentTargetEntity = aiComp.target ? manager.getEntityById(aiComp.target.id) : null;
      if (!currentTargetEntity || !currentTargetEntity.hasComponent(PositionComponent)) {
        if (playerTargets.length > 0) {
          currentTargetEntity = playerTargets[0];
          aiComp.target = currentTargetEntity;
        } else {
          aiComp.state = 'idle';
          if (velocityComp) { // If VelocityComponent still exists, zero it out
            velocityComp.vx = 0;
            velocityComp.vy = 0;
          }
          continue;
        }
      }

      const targetPosComp = currentTargetEntity.getComponent(PositionComponent);
      if (!targetPosComp) {
          aiComp.state = 'idle';
          velocityComp.vx = 0;
          velocityComp.vy = 0;
          continue;
      }

      const dx = targetPosComp.x - posComp.x;
      const dy = targetPosComp.y - posComp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const currentTime = Date.now();

      const body = physicsComp.body;
      // Use properties from PhysicsComponent for tuning
      const maxSpeed = physicsComp.maxSpeed || 2;
      const accelerationForce = physicsComp.accelerationForce || 100;

      // Rotate AI to face target
      const angleToTarget = Math.atan2(dy, dx);
      body.quaternion.setFromEuler(0, angleToTarget - Math.PI/2, 0); // Assuming bot's "front" is along local X after rotation


      if (distance < aiComp.perceptionRadius) {
        if (distance > aiComp.attackRange) { // Seeking state
          aiComp.state = 'seeking';
          // const forceMagnitude = acceleration; // Old way
          const force = new CANNON.Vec3(
            (dx / distance) * accelerationForce, // Use accelerationForce from component
            0,
            (dy / distance) * accelerationForce // Game Y to Physics Z
          );
          body.applyForce(force, body.position);

          // Clamp velocity
          const currentVel = body.velocity;
          const speed = Math.sqrt(currentVel.x*currentVel.x + currentVel.z*currentVel.z);
          if (speed > maxSpeed) {
              const factor = maxSpeed / speed;
              body.velocity.x *= factor;
              body.velocity.z *= factor;
          }

        } else { // Attacking state (in range)
          aiComp.state = 'attacking';
          // Stop moving when in attack range (rely on damping or apply counter-force if needed)
          // For simplicity, let linearDamping handle slowdown.

          if (weaponComp && weaponComp.canShoot(currentTime)) {
            if (energyComp && weaponComp.energyCost > 0 && !energyComp.consumeEnergy(weaponComp.energyCost)) {
              // Not enough energy
            } else {
              weaponComp.recordShot(currentTime);
              // console.log(`AI ${entity.id} firing at ${currentTargetEntity.id}!`);

              // Trigger fire recoil animation for AI
              const animComp = entity.getComponent(AnimationComponent);
              if (animComp) {
                animComp.play('fireRecoil', true);
              }

              // Muzzle flash for AI
              const aiRenderSize = entity.getComponent(RenderComponent)?.size || 30;
              const muzzleOffsetX = aiRenderSize * 0.6;
              const angle = physicsComp.body.angle; // Assumes PhysicsSystem updates this from quaternion
              const muzzleFlashSpawnX = posComp.x + Math.cos(angle) * muzzleOffsetX;
              const muzzleFlashSpawnY = posComp.y + Math.sin(angle) * muzzleOffsetX;
              particleSystem.createEffect('muzzleFlash', muzzleFlashSpawnX, muzzleFlashSpawnY, 8, { rotation: angle });


              const projectileEntity = manager.createEntity();
              const ownerRotation = physicsComp.body.quaternion;

              const spawnOffsetDistance = aiRenderSize + 5;
              let localOffset = new CANNON.Vec3(spawnOffsetDistance, 0, 0);
              let worldOffset = ownerRotation.vmult(localOffset);
              const spawnPosition = {
                x: posComp.x + worldOffset.x,
                y: posComp.y + worldOffset.z,
                zPhysics: (physicsComp.body.shapes[0]?.halfExtents?.y || (physicsComp.size?.height || 60)/2)
              };

              projectileEntity.addComponent(new PositionComponent(spawnPosition.x, spawnPosition.y));

              let projectileVelocityVec = new CANNON.Vec3(weaponComp.projectileSpeed, 0, 0);
              projectileVelocityVec = ownerRotation.vmult(projectileVelocityVec);
              projectileEntity.addComponent(new VelocityComponent(projectileVelocityVec.x, projectileVelocityVec.z));

              projectileEntity.addComponent(new RenderComponent(
                weaponComp.projectileType === 'bullet' ? 'circle' : 'rectangle',
                weaponComp.projectileColor, null, true, 0, weaponComp.projectileSize
              ));

              const projectileShape = new CANNON.Sphere(weaponComp.projectileSize / 2);
              const projectileBody = new CANNON.Body({
                mass: 0.1, shape: projectileShape,
                position: new CANNON.Vec3(spawnPosition.x, spawnPosition.zPhysics, spawnPosition.y),
                velocity: new CANNON.Vec3(projectileVelocityVec.x, projectileVelocityVec.y, projectileVelocityVec.z),
                material: physicsEngine.materials.projectileMaterial,
                collisionFilterGroup: 2, collisionFilterMask: -1,
              });
              projectileBody.userData = { entityId: projectileEntity.id, type: 'projectile' };
              physicsEngine.world.addBody(projectileBody);

              projectileEntity.addComponent(new PhysicsComponent(projectileBody, 0.1, {radius: weaponComp.projectileSize / 2}));
              projectileEntity.addComponent(new ProjectileComponent(
                weaponComp.projectileDamage, entity.id, weaponComp.projectileLifetime
              ));
            }
          }
        }
      } else { // Target out of perception or lost
        aiComp.state = 'idle';
        // No force applied, linear damping will slow it down.
      }

      // Update VelocityComponent if it exists, for other systems to read
      if (velocityComp) {
        velocityComp.vx = body.velocity.x;
        velocityComp.vy = body.velocity.z;
      }
    }
  }
}

module.exports = AISystem;
