import System from '../System.js';
import AnimationComponent from '../components/AnimationComponent.js';
import RenderComponent from '../components/RenderComponent.js';
import PositionComponent from '../components/PositionComponent.js';

// Simple Easing Functions (can be expanded or moved to a utility file)
const EasingFunctions = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutElastic: t => { // Example of a more complex one
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

class AnimationSystem extends System {
  constructor(entityManager) {
    super();
    this.entityManager = entityManager;
  }

  update(entities, deltaTime) {
    for (const entity of entities) {
      const animComp = entity.getComponent(AnimationComponent);
      if (!animComp || !animComp.currentAnimation || !animComp.isPlaying()) {
        continue;
      }

      animComp.animationTime += deltaTime;
      animComp.animationProgress = Math.min(1.0, animComp.animationTime / animComp.animationDuration);

      const easingFunc = EasingFunctions[animComp.currentEasingFunction] || EasingFunctions.linear;
      const easedProgress = easingFunc(animComp.animationProgress);

      // Apply animations
      // This is a crucial part: deciding where and how to store original values
      // and apply animated values.
      // Option 1: AnimationComponent stores original values when animation starts.
      // Option 2: Components like RenderComponent have base values and offset/modifier values.
      // Let's try a hybrid: AnimationSystem fetches "original" when an animation begins if not already stored.
      // For now, we'll assume targetProperties are *offsets* or *multipliers* to apply.

      const renderComp = entity.getComponent(RenderComponent);
      const posComp = entity.getComponent(PositionComponent);

      for (const propName in animComp.currentTargetProperties) {
        const targetValue = animComp.currentTargetProperties[propName];

        // Assuming targetValue is the *final offset/multiplier* at progress = 1.
        // The animated value is the current interpolated offset/multiplier.
        let currentValue;
        if (typeof targetValue === 'number') {
            // If originalProperties[propName] was 0 or undefined, this is a direct application of eased offset
            // For example, if target is an offset like `renderOffsetY: 10`, then at 50% progress, offset is 5.
            currentValue = targetValue * easedProgress;
        } else {
            // Non-numeric properties aren't directly interpolated this way (e.g. color change might need specific logic)
            // For now, focus on numeric offsets.
            currentValue = animComp.animatedValues[propName]; // Keep as is if not numeric
        }
        animComp.animatedValues[propName] = currentValue;

        // Apply to actual components - this part needs careful design
        // Example: 'renderOffsetY' applies to RenderComponent's drawing offset
        // Example: 'positionOffsetX' applies to PositionComponent's x value (or an offset property)
        if (renderComp) {
            if (propName === 'renderOffsetY') renderComp.animationOffsetY = currentValue;
            if (propName === 'renderOffsetX') renderComp.animationOffsetX = currentValue;
            if (propName === 'renderRotationOffset') renderComp.animationRotationOffset = currentValue; // Radians
            if (propName === 'renderScale') renderComp.animationScale = 1 + (targetValue -1) * easedProgress; // If targetValue is a scale factor e.g. 1.2
             // For a temporary color tint, RenderComponent would need a `tintColor` property
            if (propName === 'tintColor') renderComp.animationTintColor = targetValue; // This needs color interpolation logic
        }
        // if (posComp) {
        //   if (propName === 'positionOffsetX') posComp.animationOffsetX = currentValue;
        //   if (propName === 'positionOffsetY') posComp.animationOffsetY = currentValue;
        // }
      }

      if (animComp.animationProgress >= 1.0) {
        if (animComp.resetsToOriginal) {
          // Reset properties: set animatedValues back to 0 or base state
          for (const propName in animComp.animatedValues) {
            animComp.animatedValues[propName] = 0; // Reset offsets
             if (renderComp) { // Reset actual component properties if they were directly modified
                if (propName === 'renderOffsetY') renderComp.animationOffsetY = 0;
                if (propName === 'renderOffsetX') renderComp.animationOffsetX = 0;
                if (propName === 'renderRotationOffset') renderComp.animationRotationOffset = 0;
                if (propName === 'renderScale') renderComp.animationScale = 1;
                if (propName === 'tintColor') renderComp.animationTintColor = null; // Clear tint
            }
            // if (posComp) {
            //    if (propName === 'positionOffsetX') posComp.animationOffsetX = 0;
            //    if (propName === 'positionOffsetY') posComp.animationOffsetY = 0;
            // }
          }
        }
        // If not looping, stop the animation. Looping logic could be added here.
        animComp.currentAnimation = null;
        animComp.animationTime = 0;
        animComp.animationProgress = 0;
      }
    }
  }
}

export default AnimationSystem;
