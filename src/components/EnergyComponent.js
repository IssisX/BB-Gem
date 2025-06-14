const Component = require('../Component');

class EnergyComponent extends Component {
  constructor(maxEnergy = 100, regenerationRate = 5) { // regenerationRate is units per second
    super();
    this.currentEnergy = maxEnergy;
    this.maxEnergy = maxEnergy;
    this.regenerationRate = regenerationRate; // Energy points per second
  }

  consumeEnergy(amount) {
    if (this.currentEnergy >= amount) {
      this.currentEnergy -= amount;
      return true;
    }
    return false; // Not enough energy
  }

  regenerate(deltaTime) { // deltaTime in seconds
    if (this.currentEnergy < this.maxEnergy) {
      this.currentEnergy += this.regenerationRate * deltaTime;
      if (this.currentEnergy > this.maxEnergy) {
        this.currentEnergy = this.maxEnergy;
      }
    }
  }
}

module.exports = EnergyComponent;
