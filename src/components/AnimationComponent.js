import Component from '../Component.js';

class AnimationComponent extends Component {
  constructor(animations = {}) {
    super();
    // Store a map of animation definitions
    // Example: animations = {
    //   'fireRecoil': {
    //     targetProperties: { renderOffsetY: -5, weaponRotationOffset: -0.1 },
    //     duration: 0.1,
    //     easingFunction: 'easeOutQuad',
    //     resetsToOriginal: true // Does it return to original state or stay?
    //   },
    //   'hitReact': { ... }
    // }
    this.animations = animations;

    this.currentAnimation = null; // Name of the currently playing animation
    this.animationProgress = 0;   // 0 to 1
    this.animationTime = 0;       // Time elapsed for current animation
    this.animationDuration = 0;   // Duration of current animation
    this.currentEasingFunction = 'linear';
    this.resetsToOriginal = true; // Whether the animation should return to base state after finishing

    // Store the original state of properties being animated
    this.originalProperties = {};
    // Store the target state for the current animation
    this.currentTargetProperties = {};
    // Store the current animated values (offsets or direct values)
    this.animatedValues = {}; // e.g., { renderOffsetY: 0, weaponRotationOffset: 0 }
  }

  play(animationName, forceRestart = false) {
    if (!this.animations[animationName]) {
      console.warn(`AnimationComponent: Animation '${animationName}' not defined.`);
      return;
    }
    if (this.currentAnimation === animationName && !forceRestart && this.animationTime < this.animationDuration) {
      // Animation already playing and not forced to restart
      return;
    }

    const animDef = this.animations[animationName];
    this.currentAnimation = animationName;
    this.animationTime = 0;
    this.animationProgress = 0;
    this.animationDuration = animDef.duration || 0.5; // Default duration 0.5s
    this.currentEasingFunction = animDef.easingFunction || 'linear';
    this.resetsToOriginal = animDef.resetsToOriginal !== undefined ? animDef.resetsToOriginal : true;
    this.currentTargetProperties = JSON.parse(JSON.stringify(animDef.targetProperties || {})); // Deep copy

    // Clear previous animatedValues and prepare for new ones based on targetProperties
    this.animatedValues = {};
    for (const key in this.currentTargetProperties) {
        this.animatedValues[key] = 0; // Initialize animated values (typically offsets start at 0)
    }
    // Storing original properties would happen in AnimationSystem when it starts processing this
    // OR, components being animated need a "base" state.
    // For simplicity here, AnimationSystem will manage fetching originals.
  }

  stop() {
    // If resetsToOriginal is true, AnimationSystem should handle resetting properties
    this.currentAnimation = null;
    this.animationTime = 0;
    this.animationProgress = 0;
    // Reset animatedValues to ensure no lingering offsets if animation is stopped prematurely
    for (const key in this.animatedValues) {
        this.animatedValues[key] = 0;
    }
  }

  // isPlaying() and getAnimatedValue(propertyName) can be useful helpers
  isPlaying() {
    return this.currentAnimation !== null && this.animationTime < this.animationDuration;
  }

  getAnimatedValue(propName) {
    return this.animatedValues[propName] || 0; // Default to 0 if not set
  }
}

export default AnimationComponent;
