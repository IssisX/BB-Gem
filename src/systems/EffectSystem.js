import System from '../System.js';
import EffectComponent from '../components/EffectComponent.js';
import PositionComponent from '../components/PositionComponent.js';
import RenderComponent from '../components/RenderComponent.js';

class EffectSystem extends System {
  constructor(entityManager) {
    super();
    this.entityManager = entityManager;
  }

  update(entities, deltaTime, entityManager) {
    const currentEntityManager = entityManager || this.entityManager;
    const effectsToRemove = [];

    for (const entity of entities) {
      const effectComp = entity.getComponent(EffectComponent);
      if (!effectComp) continue;

      effectComp.update(deltaTime);

      if (!effectComp.isAlive()) {
        effectsToRemove.push(entity.id);
        continue;
      }

      // Update RenderComponent if the effect has one (e.g., for flares)
      // Screen tints might be handled differently by RenderSystem (e.g., a full-screen overlay)
      const renderComp = entity.getComponent(RenderComponent);
      if (renderComp) {
        if (effectComp.effectType === 'flare' || effectComp.effectType === 'aura') {
          renderComp.color = effectComp.getCurrentColor(); // Includes opacity
          renderComp.size = effectComp.getCurrentSize();
          // Ensure flare is visible
          renderComp.isVisible = true;
        }
        // For screenTint, RenderSystem might check for active screenTint effects directly
        // or this system could set a global state if that's preferred.
      }
    }

    for (const entityId of effectsToRemove) {
      currentEntityManager.removeEntity(entityId);
    }
  }

  // --- Effect Creation Helper Methods (called by other systems) ---

  /**
   * Creates a general effect entity.
   * @param {string} type - 'flare', 'screenTint', etc.
   * @param {object} options - Properties for EffectComponent.
   * @param {object} [position] - Optional {x, y} for positional effects.
   * @param {object} [renderOptions] - Optional properties for RenderComponent if it's a visual world effect.
   */
  createEffect(type, options, position, renderOptions) {
    if (!this.entityManager) return null;

    const effectEntity = this.entityManager.createEntity();

    options.effectType = type;
    effectEntity.addComponent(new EffectComponent(options));

    if (position) {
      effectEntity.addComponent(new PositionComponent(position.x, position.y));
    }

    if (renderOptions && (type === 'flare' || type === 'aura')) {
      // Example: Flares are circles by default
      const shape = renderOptions.shape || 'circle';
      const initialColor = options.color ?
        `rgba(${options.color[0]},${options.color[1]},${options.color[2]},${(options.startOpacity !== undefined ? options.startOpacity : 1.0) * (options.color[3] !== undefined ? options.color[3] : 1.0)})`
        : 'rgba(255,255,255,0.5)';
      const initialSize = options.startSize !== undefined ? options.startSize : options.size;

      effectEntity.addComponent(new RenderComponent(
        shape,
        initialColor,
        null, // spriteName
        true, // isVisible
        renderOptions.layer || 5, // Effects on a high layer
        initialSize
      ));
    }

    // console.log(`Created effect: ${type}`, effectEntity);
    return effectEntity;
  }

  createMuzzleFlashIllumination(x, y, size = 100, duration = 0.15) {
    return this.createEffect('flare', {
      duration: duration,
      maxDuration: duration,
      color: [255, 220, 180, 0.8], // Bright yellowish-orange, semi-transparent
      startSize: size,
      endSize: size * 0.3,
      startOpacity: 0.8, // From color alpha
      endOpacity: 0,
    }, { x, y }, { shape: 'circle', layer: 5 });
  }

  createExplosionLightFlash(duration = 0.3, color = [255,255,200, 0.3], startOpacity = 0.3, endOpacity = 0) {
    // This creates a screen-wide effect. RenderSystem will need to handle drawing this.
    // It does not need a PositionComponent or a standard RenderComponent meant for world objects.
    return this.createEffect('screenTint', {
        duration: duration,
        maxDuration: duration,
        color: color,
        startOpacity: startOpacity,
        endOpacity: endOpacity,
    }); // No position, no specific renderOptions for world object
  }
}

export default EffectSystem;
