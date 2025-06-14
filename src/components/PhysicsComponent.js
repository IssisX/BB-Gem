const Component = require('../Component');

class PhysicsComponent extends Component {
  constructor(body = null, options = {}) {
    super();
    this.body = body; // This will hold the CANNON.Body object

    // Common physics properties, can be used to configure the body or by systems
    this.mass = options.mass || 1;
    this.size = options.size || { width: 1, height: 1, depth: 1, radius: 0.5 }; // For shape creation / reference

    this.maxSpeed = options.maxSpeed || 5; // Max linear speed
    this.accelerationForce = options.accelerationForce || 100; // Force applied for movement

    // Damping reduces velocity over time, simulating friction/air resistance
    this.linearDamping = options.linearDamping !== undefined ? options.linearDamping : 0.5;
    this.angularDamping = options.angularDamping !== undefined ? options.angularDamping : 0.5;

    // Material properties (could be references to CANNON.Material instances or just names)
    this.friction = options.friction !== undefined ? options.friction : 0.3;
    this.restitution = options.restitution !== undefined ? options.restitution : 0.1; // Bounciness

    // For movement control if not directly manipulating body.velocity
    // These might be set by input/AI systems and then applied by PhysicsSystem.
    // However, with direct force application, these might be less used for setting,
    // but can be useful for reading current state if needed.
    this.targetVelocity = { x: 0, y: 0, z: 0 }; // Desired velocity
    this.currentVelocity = { x: 0, y: 0, z: 0 }; // Actual current velocity from body, updated by PhysicsSystem

    // If the body is created outside and passed in, ensure its properties are updated
    if (this.body) {
        this.body.mass = this.mass;
        this.body.linearDamping = this.linearDamping;
        this.body.angularDamping = this.angularDamping;
        // Materials are more complex, often set on body.shapes or via ContactMaterials
        // For now, assume they are handled at body creation time.
        // if (this.body.shapes[0] && this.body.shapes[0].material) {
        //    this.body.shapes[0].material.friction = this.friction;
        //    this.body.shapes[0].material.restitution = this.restitution;
        // }
        this.body.updateMassProperties();
    }
  }
}

module.exports = PhysicsComponent;
