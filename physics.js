// physics.js – compatibility patch for Cannon-es
// ==============================================
// This file replaces the original physics module
// to resolve the runtime error: `this.world.add is not a function`
// The root cause: cannon‑es changed the API from world.add() → world.addBody().
//
// We provide a shim so legacy calls to .add continue to work *and*
// migrate all internal usages to the new canonical .addBody().

import * as CANNON from 'https://cdn.skypack.dev/cannon-es@0.20.0';

export class PhysicsEngine {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();

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
