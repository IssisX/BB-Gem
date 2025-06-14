class Entity {
  constructor(id, entityManager) { // Added id and entityManager
    this.id = id; // ID assigned by EntityManager
    this.entityManager = entityManager; // Reference to the EntityManager
    this.components = new Map(); // Store components by their class (constructor)
  }

  addComponent(component) {
    this.components.set(component.constructor, component);
    if (this.entityManager) {
      this.entityManager._mapEntityComponent(this, component.constructor);
    }
    return this; // For chaining
  }

  getComponent(componentClass) {
    return this.components.get(componentClass);
  }

  hasComponent(componentClass) {
    return this.components.has(componentClass);
  }

  removeComponent(componentClass) {
    if (this.hasComponent(componentClass)) {
      this.components.delete(componentClass);
      if (this.entityManager) {
        this.entityManager._unmapEntityComponent(this, componentClass);
      }
    }
    return this; // For chaining
  }

  getAllComponents() {
    return Array.from(this.components.values());
  }

  // Optional: for debugging or specific use cases
  toString() {
    return `Entity(${this.id}, Components: [${Array.from(this.components.keys()).map(c => c.name).join(', ')}])`;
  }
}

module.exports = Entity;
