const Component = require('../Component');

class PlayerControlledComponent extends Component {
  constructor() {
    super();
    // Cooldown for boost/dash ability
    this.boostCooldown = 2000; // Milliseconds (e.g., 2 seconds)
    this.lastBoostTime = 0;
  }

  canBoost(currentTime) {
    return (currentTime - this.lastBoostTime) >= this.boostCooldown;
  }

  recordBoost(currentTime) {
    this.lastBoostTime = currentTime;
  }
}

module.exports = PlayerControlledComponent;
