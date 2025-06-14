const Component = require('../Component');

class VelocityComponent extends Component {
  constructor(vx = 0, vy = 0) {
    super();
    this.vx = vx;
    this.vy = vy;
  }
}

module.exports = VelocityComponent;
