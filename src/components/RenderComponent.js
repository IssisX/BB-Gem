import Component from '../Component.js';

class RenderComponent extends Component {
  constructor(shape = 'circle', color = 'blue', spriteName = null, isVisible = true, zOrder = 0, size = 10, width, height, glowColor, glowSize) { // Added more params from projectile creation
    super();
    this.shape = shape;
    this.color = color;
    this.spriteName = spriteName; // Base sprite for the entity (e.g., chassis sprite)
    this.isVisible = isVisible;
    this.size = size;
    this.zOrder = zOrder; // Base z-order for the whole entity or its main part

    // Properties for animation system to modify
    this.animationOffsetX = 0;
    this.animationOffsetY = 0;
    this.animationRotationOffset = 0;
    this.animationScale = 1;
    this.animationTintColor = null;
    this.opacity = 1.0;

    // For multi-part entities like bots with chassis, weapons, etc.
    // Each item in 'layers' defines a visual part.
    // partType: helps identify (e.g., 'chassis', 'weapon', 'decal')
    // sprite: path to the image for this part
    // offsetX, offsetY: position relative to the entity's main PositionComponent
    // rotation: relative rotation of this part
    // zOrderOffset: offset from the main component's zOrder, for layering parts
    // width, height: dimensions for this part's sprite (can override a global size)
    // color: optional tint for this specific part
    this.layers = []; // Example: [{ partType: 'chassis', sprite: '...', offsetX: 0, offsetY: 0, rotation: 0, zOrderOffset: 0, width: 50, height: 50}, ...]

    // Properties for visual damage states
    this.damageSprites = {}; // e.g., { 0: 'normal_chassis.png', 1: 'damaged_chassis.png' }
                            // This could also be a map of partType to damage sprites:
                            // { chassis: {0: '...', 1: '...'}, weapon_slot_1: {0: '...', 1: '...'} }
    this.damageDecals = []; // e.g., [{ spriteName: 'decal.png', offsetX: ..., minDamageLevel: 1 }]
  }
}

module.exports = RenderComponent;
