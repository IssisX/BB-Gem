class System {
  constructor() {
    // Base system class
  }

  update(entities, deltaTime) {
    // This method should be overridden by subclasses
    // 'entities' is an array of all entities in the game
    // 'deltaTime' is the time elapsed since the last frame
    throw new Error('System.update() must be implemented by subclasses');
  }
}

module.exports = System;
