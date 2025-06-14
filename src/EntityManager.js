import Entity from './Entity.js';

class EntityManager {
  constructor() {
    this.entities = new Map(); // Store entities by ID
    this.nextEntityId = 0; // Simple ID generation
    this.entitiesByComponent = new Map(); // Map component class name to a Set of entity IDs
    this.componentClasses = new Map(); // Store component classes by name for easier lookup
  }

  _getNextEntityId() {
    return `entity_${this.nextEntityId++}`;
  }

  createEntity(id = null) {
    const entityId = id || this._getNextEntityId();
    const entity = new Entity(entityId, this); // Pass EntityManager to Entity
    this.entities.set(entityId, entity);
    return entity;
  }

  addEntity(entity) {
    if (!entity.id || this.entities.has(entity.id)) {
      console.warn('Entity already exists or has no ID. Not adding.', entity);
      return;
    }
    this.entities.set(entity.id, entity);
    // Update component mappings if entity already has components (e.g. from a template)
    for (const component of entity.getAllComponents()) {
        this._mapEntityComponent(entity, component.constructor);
    }
  }

  removeEntity(entityOrId) {
    const entityId = typeof entityOrId === 'string' ? entityOrId : entityOrId.id;
    const entity = this.entities.get(entityId);
    if (entity) {
      // Remove from component mappings
      for (const componentClass of entity.components.keys()) {
        const className = componentClass.name;
        if (this.entitiesByComponent.has(className)) {
          this.entitiesByComponent.get(className).delete(entityId);
        }
      }
      this.entities.delete(entityId);
      // console.log(`Entity ${entityId} removed`);
    }
  }

  getEntityById(id) {
    return this.entities.get(id);
  }

  // Called by Entity when a component is added or removed
  _mapEntityComponent(entity, componentClass) {
    const className = componentClass.name;
    if (!this.componentClasses.has(className)) {
        this.componentClasses.set(className, componentClass);
    }
    if (!this.entitiesByComponent.has(className)) {
      this.entitiesByComponent.set(className, new Set());
    }
    this.entitiesByComponent.get(className).add(entity.id);
  }

  _unmapEntityComponent(entity, componentClass) {
    const className = componentClass.name;
    if (this.entitiesByComponent.has(className)) {
      this.entitiesByComponent.get(className).delete(entity.id);
    }
  }

  getEntitiesWithComponents(componentClasses) {
    if (!componentClasses || componentClasses.length === 0) {
      return Array.from(this.entities.values());
    }

    const classNames = componentClasses.map(c => (typeof c === 'string' ? c : c.name));

    let resultSet;
    let isFirst = true;

    for (const className of classNames) {
        const entityIdsWithComponent = this.entitiesByComponent.get(className);
        if (!entityIdsWithComponent || entityIdsWithComponent.size === 0) {
            return []; // If any component is missing from all entities, intersection is empty
        }

        if (isFirst) {
            resultSet = new Set(entityIdsWithComponent);
            isFirst = false;
        } else {
            resultSet = new Set([...resultSet].filter(id => entityIdsWithComponent.has(id)));
        }
        if (resultSet.size === 0) return []; // Early exit if intersection becomes empty
    }

    if (!resultSet) return [];

    return Array.from(resultSet).map(id => this.entities.get(id)).filter(e => e); // Filter out undefined if any ID became stale
  }

  getAllEntities() {
      return Array.from(this.entities.values());
  }

  // Helper for systems that need specific component types (e.g. physics body for CollisionSystem)
  getEntityByBodyId(bodyId) {
    const PhysicsComponent = this.componentClasses.get('PhysicsComponent');
    if (!PhysicsComponent) return null;

    const entitiesWithPhysics = this.getEntitiesWithComponents([PhysicsComponent]);
    for (const entity of entitiesWithPhysics) {
        const physicsComp = entity.getComponent(PhysicsComponent);
        if (physicsComp && physicsComp.body && physicsComp.body.id === bodyId) {
            return entity;
        }
    }
    return null;
  }
}

export default EntityManager;
