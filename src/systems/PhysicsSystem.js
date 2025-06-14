import System from '../System.js';
import PositionComponent from '../components/PositionComponent.js';
import PhysicsComponent from '../components/PhysicsComponent.js';
import VelocityComponent from '../components/VelocityComponent.js';
// CANNON is not directly used here if physicsEngine instance handles all interactions
// If direct CANNON calls were needed: import CANNON from 'cannon';

class PhysicsSystem extends System {
  constructor(physicsEngine, entityManager) {
    super();
    this.physicsEngine = physicsEngine;
    this.entityManager = entityManager; // May not be strictly needed here if physics bodies have entity IDs
  }

  update(entities, deltaTime, entityManager, ctx, camera, physicsEngine, controls) {
    // The last 4 arguments are from the GameEngine's system loop, but PhysicsSystem primarily uses its own physicsEngine.
    // It's good practice to ensure the system uses the specific instance it was constructed with.
    const physics = this.physicsEngine || physicsEngine; // Prefer injected instance

    if (!physics) {
        console.error("PhysicsSystem: Physics engine not available!");
        return;
    }

    // 1. Apply velocities from VelocityComponents to physics bodies
    for (const entity of entities) {
      const physicsComp = entity.getComponent(PhysicsComponent);
      const velocityComp = entity.getComponent(VelocityComponent);

      if (physicsComp && physicsComp.body && velocityComp) {
        // Directly set velocity. More complex physics (forces, impulses) could be handled here too.
        // Cannon.js uses (x, y, z) for velocity. Game's Y is often physics Z.
        // This assumes PlayerInputSystem/AISystem have already updated VelocityComponent.vx and .vy
        physicsComp.body.velocity.set(velocityComp.vx, 0, velocityComp.vy); // vy maps to Z
        // console.log(`Set velocity for ${entity.id}: vx=${velocityComp.vx}, vy=${velocityComp.vy}`);
      }
    }

    // 2. Step the physics simulation
    physics.update(deltaTime); // This calls Cannon's world.step()

    // 3. Update PositionComponents and PhysicsComponent's internal state from physics bodies
    for (const entity of entities) {
      const physicsComp = entity.getComponent(PhysicsComponent);
      const positionComp = entity.getComponent(PositionComponent);

      if (physicsComp && physicsComp.body && positionComp) {
        const bodyPosition = physicsComp.body.position;
        positionComp.x = bodyPosition.x;
        positionComp.y = bodyPosition.z; // Game Y from physics Z

        // Update rotation if relevant (e.g., for RenderComponent)
        // Cannon.js uses quaternions for rotation. Convert to Euler if needed.
        // For a 2D-like top-down game, often only Y-axis rotation (angle) matters.
        const bodyQuaternion = physicsComp.body.quaternion;
        // Example: Convert quaternion to Euler angle around Y (adjust as needed for your game's orientation)
        // This is a simplified conversion for yaw.
        const siny_cosp = 2 * (bodyQuaternion.w * bodyQuaternion.y + bodyQuaternion.x * bodyQuaternion.z);
        const cosy_cosp = 1 - 2 * (bodyQuaternion.y * bodyQuaternion.y + bodyQuaternion.z * bodyQuaternion.z);
        positionComp.rotation = Math.atan2(siny_cosp, cosy_cosp); // Rotation around Y axis

        // Store current velocity back into PhysicsComponent if needed for other systems (e.g. animation)
        // physicsComp.currentVelocity.x = physicsComp.body.velocity.x;
        // physicsComp.currentVelocity.y = physicsComp.body.velocity.z; // Game Y from physics Z
      }
    }
  }
}

export default PhysicsSystem;
