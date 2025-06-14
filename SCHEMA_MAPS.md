# Map Data Schema

**LLM Integration Note:** This document describes the JSON schema for defining battle arenas/maps. An LLM can use this schema to generate new map layouts, including obstacle placement, start positions, and background details. The output must be a valid JSON object matching this structure.

This document defines the JSON structure for battle arenas or maps. Each map is defined in its own JSON file (e.g., `arena_basic.json`) within a `data/maps/` directory, typically containing a single map object.

## Map Object Structure

**Fields:**

*   `mapId` (string, required): A unique identifier for the map (e.g., "arena_basic_v2", "urban_ruins_01"). Convention: `theme_name_variant`.
*   `name` (string, required): Display name of the map (e.g., "Basic Arena II", "Ruined City Sector").
*   `description` (string, optional): A brief description of the map or its tactical features. Max 300 characters.
*   `dimensions` (object, required): Defines the logical playable area size in game units.
    *   `width` (number, required): Width of the map. (e.g., 1000-5000)
    *   `height` (number, required): Height (or depth, for top-down view) of the map. (e.g., 1000-5000)
*   `background` (object, required): Describes the visual background of the map.
    *   `type` (string, required): Type of background. Valid values: "grid", "image", "color_fill".
    *   `color` (string, optional): Used if `type` is "grid" (for lines) or "color_fill" (for solid background). Hex or RGBA string (e.g., "#101015", "rgba(0,50,50,0.1)").
    *   `imagePath` (string, optional): Path to the background image/texture, used if `type` is "image". Relative to an assets directory (e.g., "sprites/bg/industrial_floor.png").
    *   `gridSize` (number, optional): Size of grid cells in game units if `type` is "grid". (e.g., 50, 100)
    *   `layers` (array of objects, optional): For parallax backgrounds or layered visual effects.
        *   `imagePath` (string, required): Path to the layer's image.
        *   `scrollFactorX`, `scrollFactorY` (number, required): Multiplier for scrolling speed relative to camera movement (e.g., 0.1 for distant, 1.0 for same speed).
        *   `zIndex` (number, optional): CSS-like z-index for ordering background layers. Lower values are further back. Defaults to 0.
        *   `opacity` (number, optional): Opacity of the layer (0.0 to 1.0). Defaults to 1.0.
        *   `blendMode` (string, optional): Canvas `globalCompositeOperation` value (e.g., "lighter", "multiply").
*   `playerStartPositions` (array of objects, required): Defines starting positions and orientations for players/bots.
    *   Each object: `{ "id": string (optional, e.g. "player1_spawn"), "x": number, "y": number, "angle": number (optional, in degrees, 0 is typically right) }`.
    *   The order might correspond to player index. At least two for 1v1.
*   `obstacles` (array of objects, optional): Defines static or dynamic obstacles in the arena.
    *   `obstacleId` (string, required): Unique ID for this obstacle instance on the map (e.g., "center_pillar", "barrel_explosive_01").
    *   `type` (string, optional): A category for the obstacle, e.g., "static_box", "destructible_crate", "energy_barrier", "dynamic_cylinder". Helps in applying specific logic or default physics.
    *   `x`, `y` (number, required): Center position of the obstacle in world coordinates.
    *   `z` (number, optional): Vertical position offset from the ground plane (if relevant for 3D physics, default 0). For 2.5D top-down, this might be half of the obstacle's visual height if its origin is at its base.
    *   `width` (number, required for box-like shapes): Width dimension.
    *   `height` (number, required for box-like shapes): Height dimension (visual height or physics Y-extent depending on setup).
    *   `depth` (number, optional for box-like shapes): Depth dimension (game's Y-axis for top-down). If not provided, might assume same as width for square footprint.
    *   `radius` (number, optional for sphere/cylinder shapes): Radius.
    *   `rotation` (number, optional): Rotation in degrees (0-360) around the object's vertical axis. Defaults to 0.
    *   `render` (object, required): Visual properties.
        *   `sprite` (string, optional): Path to the obstacle's sprite.
        *   `shape` (string, optional): If no sprite, a basic shape like "rectangle", "circle", "cylinder_top".
        *   `color` (string, optional): Color for the shape or a tint for the sprite (e.g., "#A0A0A0").
        *   `width`, `height` (number, optional): Visual dimensions if different from physical, or for shape drawing.
    *   `physics` (object, required): Physics properties.
        *   `isStatic` (boolean, optional): True if the obstacle cannot be moved. Defaults to true. If false, `mass` is required.
        *   `mass` (number, optional): Mass of the obstacle if dynamic. Defaults to 0 (static). (e.g., 10-1000 for dynamic)
        *   `friction` (number, optional): Friction coefficient (0 to 1). Defaults to ~0.5.
        *   `restitution` (number, optional): Bounciness (0 to 1). Defaults to ~0.2.
        *   `shape` (string, required): Physics body shape: "box", "sphere", "cylinder".
        *   `collisionGroup` (string, optional): E.g., "ENVIRONMENT", "DESTRUCTIBLE".
*   `powerUps` (array of objects, optional): Defines locations and types of power-ups.
    *   `type` (string, required): ID of the power-up type (e.g., "health_pack_small", "energy_cell", "damage_boost_short"). Links to a separate power-up definition file/object.
    *   `x`, `y` (number, required): Position of the power-up spawn point.
    *   `respawnTime` (number, optional): Time in seconds for the power-up to respawn after being collected. (e.g., 15-60)
    *   `initialDelay` (number, optional): Delay in seconds before the first spawn. Defaults to 0.
*   `audio` (object, optional): Map-specific audio settings.
    *   `backgroundMusicId` (string, optional): ID of the background music track for this map.
    *   `ambientSoundIds` (array of strings, optional): IDs of ambient sound loops.
*   `lighting` (object, optional): Basic map lighting.
    *   `globalAmbientColor` (string, optional): Ambient light color (e.g., "rgba(50,50,70,0.1)").

**Example `default_arena.json` entry (renamed from `arena_basic.json` for schema consistency):**
```json
{
    "mapId": "default_arena_01",
    "name": "Default Training Arena",
    "description": "A standard arena for bot combat simulations.",
    "dimensions": { "width": 2200, "height": 1600 },
    "background": {
        "type": "grid",
        "color": "rgba(0, 100, 100, 0.2)",
        "gridSize": 75
    },
    "playerStartPositions": [
        { "id": "P1_Start", "x": -800, "y": 0, "angle": 0 },
        { "id": "P2_Start", "x": 800, "y": 0, "angle": 180 }
    ],
    "obstacles": [
        {
            "obstacleId": "center_pillar_main",
            "type": "static_box_pillar",
            "x": 0, "y": 0, "z": 50,
            "width": 200, "height": 100, "depth": 200,
            "rotation": 45,
            "render": { "shape": "rectangle", "color": "#454550", "sprite":"sprites/obstacles/tech_pillar.png" },
            "physics": { "isStatic": true, "friction": 0.4, "restitution": 0.1, "shape": "box" }
        }
        // ... more obstacles
    ]
}
```
This schema provides a detailed structure for creating diverse and functional maps.
The `GameEngine` will use this data to dynamically construct the game world.
Sprite paths and sound IDs are illustrative.
The `z` coordinate for obstacles is provided for potential 2.5D/3D physics, where Y is up in physics world. For a pure 2D top-down interpretation, `z` might be ignored or used for layering.
Player start position `angle` is in degrees, 0 pointing right.
Map dimensions define the logical playable area; visual background might extend beyond this.
Physics properties like `friction` and `restitution` on obstacles are crucial for how bots and projectiles interact with them.
Render properties for obstacles allow them to be visualized either as basic shapes or with detailed sprites.
The `powerUps` section is designed for future expansion.
