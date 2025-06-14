import Component from '../Component.js';

class ParticleComponent extends Component {
  constructor(options = {}) {
    super();
    this.life = options.life || 1; // Remaining lifetime in seconds
    this.maxLife = options.maxLife || 1; // Initial lifetime in seconds

    // Visual properties that can change over time
    this.startColor = options.startColor || [255, 255, 255, 1]; // RGBA array [r,g,b,a]
    this.endColor = options.endColor || [255, 255, 255, 0];   // RGBA array, fade to transparent

    this.startSize = options.startSize || 5;
    this.endSize = options.endSize || 1;

    this.age = 0; // Current age in seconds, incremented by deltaTime

    // New properties for enhanced behavior
    this.gravityEffect = options.gravityEffect || 0;     // Factor for how much gravity affects (0 to 1 typically)
    this.friction = options.friction || 0;             // Factor to slow down particle (0 to 1, e.g., 0.01 for light friction)
    this.rotation = options.rotation || 0;             // Initial rotation in radians
    this.angularVelocity = options.angularVelocity || 0; // Speed of rotation in radians per second

    // Optional: if particles have their own simple physics not tied to global physics engine
    // and not using VelocityComponent. If using VelocityComponent, these would be redundant here.
    // this.vx = options.vx || 0;
    // this.vy = options.vy || 0;
  }

  update(deltaTime) {
    this.age += deltaTime;
    this.life -= deltaTime;
    // Rotation update is now here, assuming it's part of particle's own state change
    this.rotation += this.angularVelocity * deltaTime;
  }

  getInterpolationFactor() {
    // Handles cases where maxLife might be 0 or life becomes negative
    if (this.maxLife <= 0) return 0;
    return Math.max(0, Math.min(1, this.life / this.maxLife));
  }

  getCurrentSize() {
    const factor = 1 - this.getInterpolationFactor(); // lerp from start to end as life decreases
    return this.startSize * (1 - factor) + this.endSize * factor;
  }

  getCurrentColor() {
    const factor = 1 - this.getInterpolationFactor(); // lerp from start to end as life decreases
    const r = this.startColor[0] * (1 - factor) + this.endColor[0] * factor;
    const g = this.startColor[1] * (1 - factor) + this.endColor[1] * factor;
    const b = this.startColor[2] * (1 - factor) + this.endColor[2] * factor;
    const a = this.startColor[3] * (1 - factor) + this.endColor[3] * factor;
    return `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${Math.max(0, Math.min(1, a)).toFixed(2)})`;
  }

  // getCurrentOpacity is implicitly handled by getCurrentColor's alpha value.
  // If separate opacity control is needed for RenderComponent, it can be added.
  // getCurrentOpacity() {
  //   const factor = 1 - this.getInterpolationFactor();
  //   return this.startColor[3] * (1 - factor) + this.endColor[3] * factor;
  // }

  isAlive() {
    return this.life > 0;
  }
}

export default ParticleComponent;
