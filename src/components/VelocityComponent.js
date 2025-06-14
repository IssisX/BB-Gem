import Component from '../Component.js';

class VelocityComponent extends Component {
  constructor(vx = 0, vy = 0, vz = 0) { // Added vz for 3D physics consistency
    super();
    this.vx = vx; // X-axis velocity in world space
    this.vy = vy; // Y-axis velocity in world space (game's Y, often maps to physics Z)
    this.vz = vz; // Z-axis velocity in world space (physics Y, game's "up/down" from plane)
  }
}

export default VelocityComponent;
