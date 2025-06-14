import System from '../System.js';
import EnergyComponent from '../components/EnergyComponent.js';

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

export default EnergySystem;
