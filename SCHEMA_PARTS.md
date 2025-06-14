# Bot Part Schemas

**LLM Integration Note:** This document describes the JSON schema for bot parts. An LLM can use this schema to generate new content for the BattleBots Arena game. Ensure generated JSON is an array of valid part objects for the specified category.

This document defines the JSON structure for different categories of bot parts. Each category has its own JSON file (e.g., `chassis.json`, `weapons.json`). These files should contain an array of part objects.

## Common Fields for All Parts

All part objects, regardless of category, should ideally include:

*   `id` (string, required): Unique identifier for the part (e.g., "chassis_light", "weapon_blaster_small"). Convention: `category_name_variant`.
*   `name` (string, required): Display name of the part (e.g., "Light Frame", "Small Blaster").
*   `category` (string, required): The category this part belongs to (e.g., "chassis", "weapon", "armor", "engine"). This should match the filename (e.g., parts in `chassis.json` should have `"category": "chassis"`).
*   `description` (string, optional): A brief description of the part for UI tooltips or information screens. Max 200 characters.
*   `sprite` (string, optional): Path to the image file for this part's visual representation (e.g., "sprites/chassis_light.png"). Relative to a common assets/sprites/ directory. Assumed to be a 2D sprite.
*   `stats` (object, optional): An object containing game-mechanical properties of the part. Fields within `stats` vary by category. All stat values should be numbers.

---

## 1. Chassis

Filename: `chassis.json`
Defines the main body of the bot. It determines base health, energy, and core physical properties.

**Fields:**

*   `id`, `name`, `category` ("chassis"), `description`, `sprite`: (Common fields)
*   `stats` (object, required):
    *   `baseHealth` (number, required): Base health points for the bot. (e.g., 50-200)
    *   `baseEnergy` (number, required): Base energy points. (e.g., 50-150)
    *   `energyRegenRate` (number, optional): Base energy regeneration rate per second. Defaults to a system value (e.g., 10) if not present. (e.g., 5-25)
    *   `maxSpeed` (number, required): Maximum movement speed in game units per second. (e.g., 3-10)
    *   `accelerationForce` (number, required): Force applied for movement. Higher values mean quicker acceleration. (e.g., 20000-50000)
    *   `mass` (number, required): Base mass of the chassis in kilograms. Affects physics interactions. (e.g., 50-150)
    *   `linearDamping` (number, optional): Linear damping for physics (0=none, 1=stops immediately). Defaults to ~0.7. (e.g., 0.5-0.9)
    *   `angularDamping` (number, optional): Angular damping for physics. Defaults to ~0.7. (e.g., 0.5-0.9)
    *   `turnSpeed` (number, optional): Factor affecting rotation speed (e.g., how quickly the bot orients). Higher is faster. (e.g., 0.05-0.2)
    *   `renderSize` (number, optional): Visual diameter or primary dimension for rendering if not using detailed sprites or for simplified views. (e.g., 40-80)
    *   `size` (object, optional): Physical dimensions for collision body. `{ "width": number, "height": number, "depth": number }`. `depth` is typically along the screen's Y-axis for 2D top-down, `height` is "up" from the plane.
*   `attachmentPoints` (object, optional): Defines locations on the chassis where other parts (like weapons) can be visually attached.
    *   Each key is a slot ID (e.g., "weaponSlot_front", "moduleSlot_top").
    *   Value is an object:
        *   `x`, `y` (number, required): Offset from the chassis center (0,0) for attachment.
        *   `zOrderOffset` (number, optional): Rendering order adjustment relative to chassis base layer (0). Positive values are on top.
        *   `allowedTypes` (array of strings, optional): Part types that can be attached here (e.g., ["small_weapon", "medium_weapon"], ["plating"], ["sensor_module"]).
        *   `defaultRotation` (number, optional): Default relative rotation in radians for the attached part (0 is typically forward).
*   `renderShape` (string, optional): If no sprite, defines a fallback shape for `RenderComponent` (e.g., 'bot', 'rectangle').

**Example `chassis.json` entry:**
```json
[
    {
        "id": "chassis_light_mk1",
        "name": "Light Frame Mk1",
        "category": "chassis",
        "sprite": "sprites/chassis/light_mk1.png",
        "description": "A nimble frame, prioritizing speed and energy over raw defense.",
        "stats": {
            "baseHealth": 75,
            "baseEnergy": 100,
            "energyRegenRate": 15,
            "maxSpeed": 7,
            "accelerationForce": 32000,
            "mass": 80,
            "linearDamping": 0.7,
            "angularDamping": 0.7,
            "turnSpeed": 0.15,
            "renderSize": 50,
            "size": { "width": 50, "height": 30, "depth": 50 }
        },
        "attachmentPoints": {
            "weaponSlot_main": {"x": 0, "y": -25, "zOrderOffset": 1, "allowedTypes": ["small_weapon", "medium_weapon"], "defaultRotation": 0}
        },
        "renderShape": "bot"
    }
]
```

---

## 2. Weapons

Filename: `weapons.json`
Defines weapon parts that can be attached to a chassis.

**Fields:**

*   `id`, `name`, `category` ("weapon"), `description`, `sprite`: (Common fields)
*   `type` (string, optional): Sub-type of weapon, for slot compatibility (e.g., "small_weapon", "medium_weapon", "heavy_weapon", "beam_weapon").
*   `renderInfo` (object, required): Describes how the *projectile* (if any) or weapon visual effect itself (e.g., beam) should be rendered. Renamed from `render` to avoid conflict with main RenderComponent.
    *   `shape` (string, required): e.g., "circle", "rectangle_projectile", "beam".
    *   `color` (string, required): Hex or RGBA string for projectile/effect color.
    *   `size` (number, optional): Primary size (e.g., radius for circle, main dimension for others).
    *   `width`, `height` (number, optional): For non-circular shapes like "rectangle_projectile" or "beam" (beam width).
    *   `maxLength` (number, optional): For beams, their maximum length.
    *   `glowColor` (string, optional): Color for a glow effect around the projectile/beam.
    *   `glowSize` (number, optional): Size/intensity of the glow.
*   `stats` (object, required):
    *   `damage` (number, required): Damage per hit, or per second for beams. (e.g., 5-50 for projectiles, 15-100 dps for beams)
    *   `fireRate` (number, required): Shots per second (for projectile weapons) or ticks per second (for beams dealing damage). (e.g., 1-10 for projectiles, 10-20 for beams)
    *   `projectileSpeed` (number, optional): Speed of projectiles in game units per second. 0 for instant beams. (e.g., 10-50)
    *   `projectileLifetime` (number, required): Lifetime of projectile in seconds. For beams, this might be very short if damage is per tick. (e.g., 0.05 for beam tick, 1-3 for projectiles)
    *   `energyCost` (number, optional): Energy consumed per shot or per second of firing. Defaults to 0. (e.g., 0-20)
    *   `spread` (number, optional): Projectile inaccuracy/spread angle in degrees. Defaults to 0. (e.g., 0-15)
    *   `isBeam` (boolean, optional): True if this is a continuous beam weapon. Defaults to false.
    *   `knockback` (number, optional): Force applied to target on hit. (e.g., 100-1000)
    *   `ammoCapacity` (number, optional): Max ammo. If not present, weapon uses energy or is unlimited.
    *   `reloadTime` (number, optional): Time in seconds to reload if ammo-based.
*   `muzzleOffset` (object, optional): Position of the muzzle relative to the weapon's attachment point (which is itself relative to chassis center).
    *   `x`, `y` (number, required): Offset coordinates.
    *   `z` (number, optional): Height offset from the attachment plane if needed.
*   `sound_fire` (string, optional): Sound effect ID for firing.
*   `sound_hit` (string, optional): Sound effect ID for projectile impact.
*   `sound_stop` (string, optional): Sound for stopping a continuous weapon like a beam.

**Example `weapons.json` entry:**
```json
[
    {
        "id": "weapon_blaster_mk1",
        "name": "Blaster Mk1",
        "category": "weapon",
        "type": "small_weapon",
        "sprite": "sprites/weapons/blaster_mk1.png",
        "description": "A standard energy blaster, reliable and efficient.",
        "renderInfo": {
            "shape": "rectangle_projectile", "color": "#FFFF00",
            "width": 4, "height": 10, "glowColor": "#FFFF88", "glowSize": 6
        },
        "stats": {
            "damage": 8,
            "fireRate": 5,
            "projectileSpeed": 30,
            "projectileLifetime": 1.2,
            "energyCost": 3,
            "spread": 3
        },
        "muzzleOffset": {"x": 0, "y": -12},
        "sound_fire": "SFX_BLASTER_FIRE_01"
    }
]
```

---

## 3. Armor

Filename: `armor.json`
Defines armor parts that provide defensive bonuses or other utility.

**Fields:**

*   `id`, `name`, `category` ("armor"), `description`, `sprite`: (Common fields)
*   `type` (string, optional): Sub-type of armor (e.g., "plating", "shield_emitter", "utility_module").
*   `stats` (object, required):
    *   `addedHealth` (number, optional): Health points added to the chassis's base health. (e.g., 10-100)
    *   `damageReduction` (number, optional): Factor for damage reduction (0.0 to 1.0). E.g., 0.1 for 10% reduction. Applied before health deduction.
    *   `addedMass` (number, optional): Mass added to the chassis. (e.g., 5-50)
    *   `shieldCapacity` (number, optional): If it's a shield emitter, the maximum shield points. (e.g., 25-150)
    *   `shieldRegenRate` (number, optional): Shield points regenerated per second. (e.g., 2-10)
    *   `shieldRechargeDelay` (number, optional): Seconds after last hit before shield regeneration starts. (e.g., 2-5)
    *   `energyConsumptionModifier` (number, optional): Factor applied to all energy costs (e.g., 1.1 for 10% increase, 0.9 for 10% decrease).
    *   `speedModifier` (number, optional): Multiplier for chassis `maxSpeed` (e.g., 0.9 for 10% speed reduction).

**Example `armor.json` entry:**
```json
[
    {
        "id": "armor_standard_plating_mk1",
        "name": "Std. Plating Mk1",
        "category": "armor",
        "type": "plating",
        "sprite": "sprites/armor/plating_mk1.png",
        "description": "Standard armor offering a good balance of protection and weight.",
        "stats": {
            "addedHealth": 35,
            "addedMass": 12,
            "damageReduction": 0.08
        }
    }
]
```

---

## 4. Engines

Filename: `engines.json`
Defines engine parts that primarily modify movement characteristics.

**Fields:**

*   `id`, `name`, `category` ("engine"), `description`, `sprite`: (Common fields)
*   `type` (string, optional): Sub-type of engine (e.g., "standard_thruster", "overdrive_core").
*   `stats` (object, required):
    *   `maxSpeedModifier` (number, optional): Multiplier for chassis's `maxSpeed` (e.g., 1.2 for 20% increase).
    *   `accelerationForceModifier` (number, optional): Multiplier for chassis's `accelerationForce`.
    *   `turnSpeedModifier` (number, optional): Multiplier for chassis's `turnSpeed`.
    *   `addedMass` (number, optional): Mass added by the engine. (e.g., 5-25)
    *   `energyCostActive` (number, optional): Passive energy drain per second while engine is "active" (if applicable for special engines).
    *   `boostForce` (number, optional): Magnitude of force for a special boost/dash ability.
    *   `boostEnergyCost` (number, optional): Energy cost for the boost.
    *   `boostCooldown` (number, optional): Cooldown in seconds for the boost.

**Example `engines.json` entry:**
```json
[
    {
        "id": "engine_standard_mk1",
        "name": "Standard Thruster Mk1",
        "category": "engine",
        "type": "standard_thruster",
        "sprite": "sprites/engines/std_mk1.png",
        "description": "A reliable thruster providing a modest boost to speed and acceleration.",
        "stats": {
            "maxSpeedModifier": 1.1,
            "accelerationForceModifier": 1.05,
            "addedMass": 8
        }
    }
]
```
This schema will guide the creation of new parts and ensure consistency.
The `GameEngine.createBotEntity` method will need to be updated to correctly sum/multiply these modifiers from different parts to arrive at the final bot stats.
The term `renderInfo` is used for weapon projectiles/effects to distinguish from a part's own `sprite`.
Sprite paths are illustrative and should point to actual asset locations.
Z-ordering of attached parts can be managed via `attachmentPoints.zOrderOffset` and render layer logic.
