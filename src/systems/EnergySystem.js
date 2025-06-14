const System = require('../System');
const EnergyComponent = require('../components/EnergyComponent');

class EnergySystem extends System {
  constructor() {
    super();
  }

  update(entities, deltaTime) { // deltaTime is in seconds
    for (const entity of entities) {
      const energyComp = entity.getComponent(EnergyComponent);

      if (energyComp) {
        energyComp.regenerate(deltaTime);
      }
    }
  }
}

module.exports = EnergySystem;
