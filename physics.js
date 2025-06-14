// physics.js – compatibility patch for Cannon-es
// ==============================================
// This file replaces the original physics module
// to resolve the runtime error: `this.world.add is not a function`
// The root cause: cannon‑es changed the API from world.add() → world.addBody().
//
// We provide a shim so legacy calls to .add continue to work *and*
// migrate all internal usages to the new canonical .addBody().

import * as CANNON from 'cannon'; // Use the alias from import map

export class PhysicsEngine {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, 0, 0), // Assuming top-down 2D, so no gravity in Y or Z
    });
    this.world.broadphase = new CANNON.NaiveBroadphase(); // Good default

    // Configure default contact material
    const defaultMaterial = new CANNON.Material('default');
    const defaultContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        defaultMaterial,
        {
            friction: 0.1,      // Low friction
            restitution: 0.25   // Some bounciness
        }
    );
    this.world.defaultContactMaterial = defaultContactMaterial;
    // Individual bodies will need their material set to 'defaultMaterial'
    // or a specific material if they need different properties.
    // This is handled in createBot in GameEngine.js by assigning materials.

    // **Compatibility shim** — map deprecated .add to .addBody
    if (typeof this.world.add !== 'function') {
      this.world.add = this.world.addBody.bind(this.world);
    }

    // Arena floor
    const ground = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
  }

  /**
   * Add a rigid body to the simulation and return the reference.
   * @param {CANNON.Shape} shape
   * @param {CANNON.Vec3} pos
   * @param {number} mass
   * @returns {CANNON.Body}
   */
  addBox(shape, pos, mass = 5) {
    const body = new CANNON.Body({ mass, shape });
    body.position.copy(pos);
    this.world.addBody(body);
    return body;
  }

  step(dt = 1 / 60) {
    this.world.step(dt);
  }
}

// Singleton export
export const physics = new PhysicsEngine();
