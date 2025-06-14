# Bot Configuration Schema

**LLM Integration Note:** This document describes the JSON schema for defining fully assembled bot configurations. An LLM can use this schema to generate new bot setups by referencing existing part IDs from `SCHEMA_PARTS.md`. The output should be a JSON object matching this structure, or an array of such objects if generating multiple configurations.

This document defines the JSON structure for fully assembled bot configurations. These configurations reference part IDs from the Part Schemas (`SCHEMA_PARTS.md`) and are used to define player presets, enemy types, or AI teammates.

Each bot configuration file (e.g., `player_presets.json`, `enemy_lineup.json`) should contain an array of bot configuration objects.

## Bot Configuration Object Structure

**Fields:**

*   `botConfigId` (string, required): A unique identifier for this specific bot configuration (e.g., "player_starter_bot", "enemy_grunt_blaster_v1"). Convention: `type_role_variant`.
*   `name` (string, required): A display name for the bot (e.g., "Player's Default Bot", "Grunt Blaster").
*   `description` (string, optional): A brief description of the bot's intended role, capabilities, or lore. Max 250 characters.
*   `chassisId` (string, required): The ID of the chassis part to be used. Must correspond to an entry in `chassis.json` (or equivalent part data).
*   `weaponIds` (array of strings, optional): An array of weapon part IDs to be equipped. IDs must correspond to entries in `weapons.json`.
    *   The order in the array could map to specific chassis attachment points if the chassis defines multiple (e.g., `chassisData.attachmentPoints.weaponSlot_main`, `chassisData.attachmentPoints.weaponSlot_secondary`). The `GameEngine` logic would need to handle this mapping.
    *   For simpler bots, only the first weapon ID might be used.
*   `armorId` (string, optional): The ID of the armor part. Must correspond to an entry in `armor.json`.
*   `engineId` (string, optional): The ID of the engine part. Must correspond to an entry in `engines.json`.
*   `customPartSlots` (object, optional): For future expansion, allowing arbitrary part categories if the chassis supports them.
    *   Key: Slot ID defined in chassis `attachmentPoints` (e.g., "module_slot_alpha").
    *   Value: Part ID (string) for the part to be equipped in that slot.
*   `aiBehaviorHint` (string, optional): A hint for the `AISystem` if this bot is an enemy or AI teammate. This string could map to predefined AI behavior profiles (e.g., "aggressive_ranged", "defensive_support", "melee_rusher", "sniper_cautious").
*   `cosmeticOverrides` (object, optional): Allows overriding visual aspects of the bot without changing its core parts or stats.
    *   `chassisSprite` (string, optional): Path to an alternative sprite for the chassis (e.g., a special skin).
    *   `weaponSprites` (object, optional): Map of weapon slot ID (from chassis `attachmentPoints`) or weapon part ID to an alternative weapon sprite path. E.g., `{ "weaponSlot_main": "sprites/weapons/custom_blaster_skin.png" }`.
    *   `primaryColor` (string, optional): A primary color override for the bot's default color scheme (e.g., "#FF0000" for a red team bot). Used by `RenderComponent`.
    *   `secondaryColor` (string, optional): A secondary color override.
    *   `decalSprite` (string, optional): Path to a specific decal sprite to apply over the chassis.
    *   `effectColors` (object, optional): Override default colors for effects like muzzle flash or engine trails. E.g., `{ "muzzleFlash": "#00FF00", "trail": "#FF00FF" }`.

**Example Bot Configuration Object:**

```json
{
    "botConfigId": "player_advanced_guardian_mk2",
    "name": "Adv. Guardian Mk2",
    "description": "A well-rounded bot with enhanced defenses and reliable plasma firepower, customized for a tactical role.",
    "chassisId": "chassis_medium_mk2",
    "weaponIds": ["weapon_plasma_cannon_mod1"],
    "armorId": "armor_plating_medium_mk2",
    "engineId": "engine_balanced_mk1",
    "customPartSlots": {
        "module_slot_alpha": "module_shield_booster_s"
    },
    "aiBehaviorHint": null,
    "cosmeticOverrides": {
        "primaryColor": "#3399FF",
        "chassisSprite": "sprites/player_skins/guardian_blue_skin.png"
    }
}
```

This schema allows for defining diverse bots by combining different parts and provides a clear structure for game data. The `GameEngine.createBotEntity` method will use this configuration to assemble bots with the correct components and stats.
The `weaponIds` array processing in `GameEngine` will need to be robust to handle single or multiple weapons and map them to available chassis slots if that level of detail is implemented.
The `customPartSlots` provides a generic way to add other part categories if the chassis supports those named slots.
