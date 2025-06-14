import Component from '../Component.js';

class AIControlledComponent extends Component {
  constructor(initialState = 'idle', target = null) {
    super();
    this.state = initialState; // e.g., 'idle', 'attacking', 'fleeing'
    this.target = target; // Reference to a target entity (e.g., the player)
    this.perceptionRadius = 10; // How far the AI can "see"
    this.attackRange = 2; // How close the AI needs to be to attack
    this.lastActionTime = 0; // Timestamp of the last significant action
    this.actionCooldown = 1000; // Milliseconds AI waits between actions
  }
}

export default AIControlledComponent;
