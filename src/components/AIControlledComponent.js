import Component from '../Component.js';

class AIControlledComponent extends Component {
  constructor(initialState = 'idle', target = null) {
    super();
    this.state = initialState;
    this.target = target;
    this.perceptionRadius = 400; // Increased from 10
    this.attackRange = 250;    // Increased from 2
    this.lastActionTime = 0;
    this.actionCooldown = 1000;
    // Consider adding other AI tuning parameters here:
    // this.retreatThreshold = 0.25; // e.g., retreat if health is below 25%
    // this.preferredEngagementRange = [150, 300]; // Min/max distance AI tries to keep
    // this.accuracy = 0.75; // For projectile firing, if implementing variable accuracy
  }
}

export default AIControlledComponent;
