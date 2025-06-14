const Component = require('../Component');

class EffectComponent extends Component {
  constructor(options = {}) {
    super();
    this.effectType = options.effectType || 'flare'; // 'flare', 'screenTint', 'aura', etc.

    this.duration = options.duration || 1; // Remaining duration in seconds
    this.maxDuration = options.maxDuration || 1; // Initial duration in seconds

    this.color = options.color || [255, 255, 255, 0.5]; // RGBA array [r,g,b,a] for tint or flare color

    // For 'flare' or positional effects
    this.size = options.size || 100; // Radius for flare, or intensity for other effects
    this.startSize = options.startSize !== undefined ? options.startSize : this.size;
    this.endSize = options.endSize !== undefined ? options.endSize : this.size * 0.5; // Flares might shrink

    // For screen tints, opacity is key. For flares, it might be part of the color's alpha.
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.startOpacity = options.startOpacity !== undefined ? options.startOpacity : this.opacity;
    this.endOpacity = options.endOpacity !== undefined ? options.endOpacity : 0; // Typically fade out

    this.age = 0;

    // Position might not be needed if the effect is screen-wide (like screenTint)
    // If it's a positional effect (like a flare), it should have a PositionComponent.
  }

  update(deltaTime) {
    this.age += deltaTime;
    this.duration -= deltaTime;
  }

  getInterpolationFactor() {
    if (this.maxDuration <= 0) return 0; // Avoid division by zero
    // Factor goes from 0 (start) to 1 (end) as effect ages
    return Math.min(1, Math.max(0, this.age / this.maxDuration));
  }

  getCurrentOpacity() {
    const factor = this.getInterpolationFactor();
    return this.startOpacity * (1 - factor) + this.endOpacity * factor;
  }

  getCurrentSize() {
    const factor = this.getInterpolationFactor();
    return this.startSize * (1 - factor) + this.endSize * factor;
  }

  getCurrentColor() {
    // This can be more complex if color itself needs to transition.
    // For now, we'll use the base color and modify its alpha based on current opacity.
    const currentOpacity = this.getCurrentOpacity();
    return `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${Math.max(0, Math.min(1, currentOpacity * this.color[3])).toFixed(2)})`;
  }

  isAlive() {
    return this.duration > 0;
  }
}

module.exports = EffectComponent;
