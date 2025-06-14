import Component from '../Component.js';

class PositionComponent extends Component {
  constructor(x = 0, y = 0, z = 0) { // Added z for potential 2.5D/3D aspects
    super();
    this.x = x;
    this.y = y; // Typically screen Y or game-world Y (if top-down)
    this.z = z; // Could be depth, or actual Z in a 3D world, or visual layer
    this.rotation = 0; // Rotation in radians, typically around Z for 2D or Y for 3D 'yaw'
  }
}

export default PositionComponent;
