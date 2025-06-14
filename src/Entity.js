class Entity {
  constructor(id, entityManager) {
    this.id = id;
    this.entityManager = entityManager;
    this.components = new Map();
  }

  addComponent(component) {
    this.components.set(component.constructor, component);
    if (this.entityManager) {
      this.entityManager._mapEntityComponent(this, component.constructor);
    }
    return this;
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
    return this;
  }

  getAllComponents() {
    return Array.from(this.components.values());
  }

  toString() {
    return `Entity(${this.id}, Components: [${Array.from(this.components.keys()).map(c => c.name).join(', ')}])`;
  }
}

export default Entity;
