import System from '../System.js';
import PlayerControlledComponent from '../components/PlayerControlledComponent.js';
import VelocityComponent from '../components/VelocityComponent.js';
import WeaponComponent from '../components/WeaponComponent.js';
import EnergyComponent from '../components/EnergyComponent.js';
import PositionComponent from '../components/PositionComponent.js';
import RenderComponent from '../components/RenderComponent.js';
import PhysicsComponent from '../components/PhysicsComponent.js';
import ProjectileComponent from '../components/ProjectileComponent.js';
import AnimationComponent from '../components/AnimationComponent.js';
import CANNON from 'cannon'; // Use import map alias

class PlayerInputSystem extends System {
  constructor(controlsManager) {
    super();
    this.controlsManager = controlsManager;
    // Assuming haptic settings are passed via gameEngine.options or a global settings object
    // For now, let's assume a helper method or direct check.
    // this.hapticsEnabled = () => gameEngineRef && gameEngineRef.options && gameEngineRef.options.hapticFeedback;
    this.inputDisabled = false;
  }

  setInputDisabled(isDisabled) {
    this.inputDisabled = isDisabled;
  }

  // Helper for haptics, assuming gameEngineRef is passed in update
  _hapticsEnabled(gameEngineRef) {
    return gameEngineRef && gameEngineRef.options && gameEngineRef.options.hapticFeedback;
  }


  update(entities, deltaTime, entityManager, ctx, camera, physicsEngine, controls, particleSystem, effectSystem, gameEngineRef) {
    const currentControls = this.controlsManager || controls;
    if (!currentControls || !entityManager || !physicsEngine || !particleSystem) {
      console.error("PlayerInputSystem: Missing crucial dependencies (ControlsManager, EntityManager, PhysicsEngine, or ParticleSystem)!");
      return;
    }

    if (this.inputDisabled) { // Check if input is disabled
        // Optionally, clear any lingering movement from inputState if needed
        // this.controlsManager.inputState.movement = {x:0, y:0};
        return;
    }

    const inputState = currentControls.getInputState();
    }
    const inputState = currentControls.getInputState();

    for (const entity of entities) {
      if (!entity.hasComponent(PlayerControlledComponent)) {
        continue;
      }

      const velocityComp = entity.getComponent(VelocityComponent);
      const weaponComp = entity.getComponent(WeaponComponent);
      const energyComp = entity.getComponent(EnergyComponent);
      const posComp = entity.getComponent(PositionComponent);
      const physicsComp = entity.getComponent(PhysicsComponent);
      const animComp = entity.getComponent(AnimationComponent);

      // Handle Movement input - Refactored to apply forces
      if (physicsComp && physicsComp.body) {
        const body = physicsComp.body;
        // Use properties from PhysicsComponent for tuning
        const maxSpeed = physicsComp.maxSpeed || 5;
        const accelerationForce = physicsComp.accelerationForce || 200;

        let moveDirectionX = 0;
        let moveDirectionY = 0; // This is game's Y, maps to physics Z

        // Determine move direction from inputState (keyboard, joystick, gamepad)
        // inputState.movement is already unified by ControlsManager
        if (inputState.movement.x > 0.1) moveDirectionX = 1;
        else if (inputState.movement.x < -0.1) moveDirectionX = -1;

        if (inputState.movement.y > 0.1) moveDirectionY = 1; // Assuming Y is already mapped correctly by ControlsManager
        else if (inputState.movement.y < -0.1) moveDirectionY = -1;


        if (moveDirectionX !== 0 || moveDirectionY !== 0) {
            // Normalize if diagonal
            const length = Math.sqrt(moveDirectionX * moveDirectionX + moveDirectionY * moveDirectionY);
            if (length > 0) {
                moveDirectionX /= length;
                moveDirectionY /= length;
            }

            const force = new CANNON.Vec3(
                moveDirectionX * acceleration,
                0, // No vertical force from player input for flying
                moveDirectionY * acceleration // Game Y to Physics Z
            );
            body.applyForce(force, body.position);

            // Clamp velocity to maxSpeed (PhysicsSystem could also do this, or it's done here)
            const currentVel = body.velocity;
            const speed = Math.sqrt(currentVel.x*currentVel.x + currentVel.z*currentVel.z);
            if (speed > maxSpeed) {
                const factor = maxSpeed / speed;
                body.velocity.x *= factor;
                body.velocity.z *= factor;
            }
        }
        // Rely on linearDamping (set on body creation) to slow down when no input.
        // If more aggressive stopping is needed, apply counter-force or increase damping when no input.
        // The VelocityComponent is no longer the primary driver for player movement if using forces.
        // It can be removed from player entities or be a read-only reflection of physics velocity.
        // For now, let's update it to reflect the physics body's velocity for other systems that might read it.
        if (velocityComp) {
            velocityComp.vx = body.velocity.x;
            velocityComp.vy = body.velocity.z;
        }
      }


      if (weaponComp && posComp && physicsComp && physicsComp.body && (inputState.keys[' '] || inputState.mouse.left)) {
        const currentTime = Date.now();
        if (weaponComp.canShoot(currentTime)) {
          if (energyComp && weaponComp.energyCost > 0 && !energyComp.consumeEnergy(weaponComp.energyCost)) {
            // Not enough energy, skip firing
          } else {
            weaponComp.recordShot(currentTime);

            // Trigger fire recoil animation
            const animComp = entity.getComponent(AnimationComponent); // Already fetched
            if (animComp) {
              animComp.play('fireRecoil', true);
            }

            // Haptic feedback for firing
            if (this._hapticsEnabled(gameEngineRef) && navigator.vibrate) {
              navigator.vibrate(10);
            }
            if (gameEngineRef && gameEngineRef.options && gameEngineRef.options.audioManager) {
                gameEngineRef.options.audioManager.playSound('shoot');
            }

            // Muzzle flash particle effect
            const playerRenderSize = entity.getComponent(RenderComponent)?.size || 30;
            const muzzleOffsetX = playerRenderSize * 0.6;
            const angle = physicsComp.body.angle;

            const muzzleFlashSpawnX = posComp.x + Math.cos(angle) * muzzleOffsetX;
            const muzzleFlashSpawnY = posComp.y + Math.sin(angle) * muzzleOffsetX;
            particleSystem.createEffect('muzzleFlash', muzzleFlashSpawnX, muzzleFlashSpawnY, 8, { rotation: angle });


            // Create Projectile Entity
            const projectileEntity = entityManager.createEntity();
            const ownerRotation = physicsComp.body.quaternion; // CANNON.Quaternion for direction

            const spawnOffsetDistance = playerRenderSize + 5; // Spawn just in front
            let localOffset = new CANNON.Vec3(spawnOffsetDistance, 0, 0); // Offset along local X
            let worldOffset = ownerRotation.vmult(localOffset); // Rotate offset to world space
            const spawnPosition = {
              x: posComp.x + worldOffset.x,
              y: posComp.y + worldOffset.z, // Game Y is physics Z
              zPhysics: (physicsComp.body.shapes[0]?.halfExtents?.y || (physicsComp.size?.height || 60)/2)
            };

            projectileEntity.addComponent(new PositionComponent(spawnPosition.x, spawnPosition.y));

            // Calculate velocity vector
            let projectileVelocityVec = new CANNON.Vec3(weaponComp.projectileSpeed, 0, 0);
            projectileVelocityVec = ownerRotation.vmult(projectileVelocityVec);

            projectileEntity.addComponent(new VelocityComponent(projectileVelocityVec.x, projectileVelocityVec.z));

            // Get render properties from weapon data (which should be on WeaponComponent)
            // This assumes WeaponComponent now stores the "render" object from the JSON.
            // If not, this needs to be fetched from DataManager via gameEngineRef, which is less ideal.
            // For now, let's assume weaponComp has these details.
            const projRenderInfo = weaponComp.renderInfo || { shape: 'circle', color: weaponComp.projectileColor, size: weaponComp.projectileSize };

            projectileEntity.addComponent(new RenderComponent(
              projRenderInfo.shape || (weaponComp.projectileType === 'bullet' ? 'circle' : 'rectangle'),
              projRenderInfo.color || weaponComp.projectileColor,
              null,
              true,
              0,
              projRenderInfo.size || weaponComp.projectileSize,
              // Add glow properties if available in projRenderInfo
              projRenderInfo.glowColor,
              projRenderInfo.glowSize
            ));

            // Physics for projectile
            const projectileShape = projRenderInfo.shape === 'rectangle_projectile'
                ? new CANNON.Box(new CANNON.Vec3((projRenderInfo.width || weaponComp.projectileSize)/2, (projRenderInfo.height || weaponComp.projectileSize/2)/2, 0.1)) // Depth is minimal for 2.5D
                : new CANNON.Sphere((projRenderInfo.size || weaponComp.projectileSize) / 2);
            const projectileBody = new CANNON.Body({
              mass: 0.1, // Small mass
              shape: projectileShape,
              position: new CANNON.Vec3(spawnPosition.x, spawnPosition.zPhysics, spawnPosition.y), // x, physicsY (height), physicsZ (gameY)
              velocity: new CANNON.Vec3(projectileVelocityVec.x, projectileVelocityVec.y, projectileVelocityVec.z), // Use full 3D velocity for Cannon
              material: physicsEngine.materials.projectileMaterial, // Assuming physicsEngine has this material
              collisionFilterGroup: 2, // Example group
              collisionFilterMask: -1, // Collide with everything
            });
            projectileBody.userData = { entityId: projectileEntity.id, type: 'projectile' };
            physicsEngine.world.addBody(projectileBody); // Directly add to world

            projectileEntity.addComponent(new PhysicsComponent(projectileBody, 0.1, {radius: weaponComp.projectileSize / 2}));

            projectileEntity.addComponent(new ProjectileComponent(
              weaponComp.projectileDamage,
              entity.id, // ownerEntityId
              weaponComp.projectileLifetime
            ));
            // entityManager.addEntity(projectileEntity);
          }
        }
      }

      // Handle Gestures
      if (inputState.swipeUp) {
        // console.log("PlayerInputSystem: Swipe Up detected for entity: " + entity.id);
        // Example: Trigger special ability if energy allows
        if (energyComp && energyComp.consumeEnergy(30)) {
          // console.log(`Entity ${entity.id} used special ability via swipe!`);
          if (animComp) animComp.play('specialAbilityActivate', true);
          if (this._hapticsEnabled(gameEngineRef) && navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
          }
          if (gameEngineRef && gameEngineRef.options && gameEngineRef.options.audioManager) {
            gameEngineRef.options.audioManager.playSound('powerup'); // Assuming 'powerup' is the special sound
          }
        }
      }
      if (inputState.swipeDown) {
        // console.log("PlayerInputSystem: Swipe Down detected for entity: " + entity.id);
        // Example: Could trigger a "crouch" or "shield bash" or request pause via gameEngine event
        // if (gameEngineRef) gameEngineRef.togglePause(); // If gameEngineRef is passed to update
      }
      // inputState.swipeLeft, inputState.swipeRight, inputState.doubleTap can be handled similarly

      // Handle action button inputs (special, shield - fire is handled above)
      // These are currently one-shot in ControlsManager, but could be flags if needed.
      if (inputState.special) {
        if (energyComp && energyComp.consumeEnergy(30)) {
            // console.log(`Entity ${entity.id} used special (button)!`);
            if (animComp) animComp.play('specialAbilityActivate', true);
            if (this._hapticsEnabled(gameEngineRef) && navigator.vibrate) {
                navigator.vibrate([50, 30, 50]);
            }
            if (gameEngineRef && gameEngineRef.options && gameEngineRef.options.audioManager) {
                gameEngineRef.options.audioManager.playSound('powerup');
            }
        }
      }
      if (inputState.shield) { // Shield logic from button/key
          // This is a toggle state, actual shield mechanics (e.g. damage reduction, energy drain)
          // would be handled by another system checking this state or a ShieldActiveComponent.
          // console.log(`Entity ${entity.id} shield toggled: ${inputState.shield}`);
          // For now, just log or set a property on PhysicsComponent if it has one for shield status
          if (physicsComp) physicsComp.isShieldActive = inputState.shield;
      }

      // Boost/Dash Mechanic (Example using doubleTap or a dedicated key if mapped)
      // Assuming 'special' key/button (inputState.special) could also be used for boost if not for other abilities.
      // Let's use doubleTap for now for touch, and potentially a new key for keyboard.
      const playerControlComp = entity.getComponent(PlayerControlledComponent); // Already available as entity has it
      if (playerControlComp && inputState.doubleTap) { // Or check for a specific key like inputState.keys['ShiftLeft']
        const currentTime = Date.now();
        if (playerControlComp.canBoost(currentTime)) {
          playerControlComp.recordBoost(currentTime);

          const boostForceMagnitude = physicsComp.accelerationForce * 0.15; // Adjust as needed, e.g., 15% of accel as impulse
          let boostDirX = velocityComp.vx;
          let boostDirY = velocityComp.vy; // Game Y, which is physics Z

          // If no current movement, boost in facing direction (requires bot's angle from physicsComp.body.angle)
          if (Math.abs(boostDirX) < 0.1 && Math.abs(boostDirY) < 0.1 && physicsComp.body) {
            const angle = physicsComp.body.angle || 0; // Should be updated by PhysicsSystem
            boostDirX = Math.cos(angle);
            boostDirY = Math.sin(angle); // Game Y
          }

          // Normalize boost direction
          const len = Math.sqrt(boostDirX * boostDirX + boostDirY * boostDirY);
          if (len > 0) {
            boostDirX /= len;
            boostDirY /= len;
          } else { // If still no direction (e.g. initial spawn), default to forward (e.g. positive X or based on current angle)
             const angle = physicsComp.body.angle || 0;
             boostDirX = Math.cos(angle);
             boostDirY = Math.sin(angle);
          }

          const impulse = new CANNON.Vec3(boostDirX * boostForceMagnitude, 0, boostDirY * boostForceMagnitude);
          physicsComp.body.applyImpulse(impulse, physicsComp.body.position);

          // console.log(`Player ${entity.id} BOOSTED!`);
          if (particleSystem) { // Boost visual effect
            particleSystem.createEffect('sparks', posComp.x, posComp.y, 10, {
                direction: {x: -boostDirX, y: -boostDirY}, // Sparks fly opposite to boost
                spreadAngle: Math.PI / 2,
                scale: 0.7
            });
          }
           if (gameEngineRef && gameEngineRef.options && gameEngineRef.options.audioManager) {
                gameEngineRef.options.audioManager.playSound('boost'); // Assuming a 'boost' sound effect
            }
        }
      }


    }
  }
}
          // For example: entity.getComponent(PhysicsComponent).isShieldActive = currentControls.inputState.shield;
      }


    }
  }
}

export default PlayerInputSystem;
