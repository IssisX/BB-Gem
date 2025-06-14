const Component = require('../Component');

class ProjectileComponent extends Component {
  constructor(damage = 10, ownerEntityId = null, lifetime = 2000) { // lifetime in ms
    super();
    this.damage = damage;
    this.ownerEntityId = ownerEntityId; // ID of the entity that fired this projectile
    this.creationTime = Date.now();
    this.lifetime = lifetime; // How long the projectile exists before self-destructing
    this.alreadyHit = new Set(); // Set of entity IDs this projectile has already hit, to prevent multiple hits
  }

  hasHit(entityId) {
    return this.alreadyHit.has(entityId);
  }

  recordHit(entityId) {
    this.alreadyHit.add(entityId);
  }

  isExpired() {
    return (Date.now() - this.creationTime) > this.lifetime;
  }
}

module.exports = ProjectileComponent;
