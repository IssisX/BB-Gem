# LLM Integration Guide for BattleBots Arena Content Generation

This guide outlines how an LLM (Large Language Model) can be used to generate new content for the BattleBots Arena game. The game utilizes a data-driven architecture where game elements like Bot Parts, fully assembled Bot Configurations, and Battle Arenas (Maps) are defined in JSON files.

## Overall Data-Driven Architecture

The game loads its content from JSON files organized into specific directories:
*   `data/parts/`: Contains JSON files for different categories of bot parts (e.g., `chassis.json`, `weapons.json`, `armor.json`, `engines.json`). Each file is an array of part objects.
*   `data/bot_configs/`: Contains JSON files for pre-assembled bot configurations (e.g., `player_defaults.json`, `enemy_types.json`). Each file is an array of bot configuration objects.
*   `data/maps/`: Contains JSON files for battle arenas (e.g., `default_arena.json`). Each file typically defines a single map object.

The game uses a `DataManager.js` module to load, parse, and provide access to this data. This module also includes methods (`loadPartFromObject`, `loadBotConfigFromObject`, `loadMapFromObject`) that allow new content to be added at runtime if provided as a valid JSON object.

## Schemas for Content Generation

To generate new content, the LLM must adhere to the specific JSON schemas defined for each content type:

1.  **Bot Parts:** Refer to `SCHEMA_PARTS.md`
    *   This schema details the structure for `chassis`, `weapons`, `armor`, `engines`, and can be extended for other part categories.
    *   Key aspects: Unique `id`, `name`, `category`, `sprite` path (optional), and a `stats` object specific to the part's function.
2.  **Bot Configurations:** Refer to `SCHEMA_BOTS.md`
    *   This schema defines how to assemble a complete bot using IDs of existing parts.
    *   Key aspects: Unique `botConfigId`, `name`, `chassisId`, arrays for `weaponIds` (and other part category IDs), optional `aiBehaviorHint`, and `cosmeticOverrides`.
3.  **Maps/Arenas:** Refer to `SCHEMA_MAPS.md`
    *   This schema defines the layout and properties of battle arenas.
    *   Key aspects: Unique `mapId`, `name`, `dimensions`, `background` details, `playerStartPositions`, and an array of `obstacles` (each with position, size, render, and physics properties).

**The LLM's output MUST be a valid JSON string that conforms to the relevant schema.**

## Example Prompts for LLM

Here are examples of how you might prompt an LLM to generate content:

**1. Generating a New Bot Part (Weapon):**

> "Generate a new 'weapon' part JSON object for a 'Cryo Beam' that slows enemies but deals low direct damage. It should be a 'medium_weapon' type. Its sprite could be 'sprites/weapons/cryo_beam_emitter.png'. The beam should be light blue. Stats should include: low damage (e.g., 2 per tick), high fireRate (e.g., 15 ticks/sec for continuous effect), very short projectileLifetime (e.g., 0.06s for a tick), moderate energyCost (e.g., 8 per tick), and a special stat `slowFactor: 0.5` for 2 seconds. Ensure the output is a single JSON object following the weapon schema in `SCHEMA_PARTS.md`."

**Expected LLM Output (Conceptual):**
```json
{
    "id": "weapon_cryo_beam_medium",
    "name": "Cryo Beam Emitter",
    "category": "weapon",
    "type": "medium_weapon",
    "sprite": "sprites/weapons/cryo_beam_emitter.png",
    "description": "Emits a chilling beam that slows targets and deals minor frost damage.",
    "renderInfo": {
        "shape": "beam",
        "color": "rgba(173, 216, 230, 0.7)",
        "maxLength": 300,
        "width": 6,
        "glowColor": "#ADD8E6",
        "glowSize": 4
    },
    "stats": {
        "damage": 2,
        "fireRate": 15,
        "projectileSpeed": 0,
        "projectileLifetime": 0.06,
        "energyCost": 8,
        "isBeam": true,
        "specialEffect": { // Custom stat block for non-standard effects
            "type": "slow",
            "slowFactor": 0.5, // 50% speed reduction
            "duration": 2 // seconds
        }
    },
    "muzzleOffset": {"x": 0, "y": -18},
    "sound_fire": "SFX_CRYO_BEAM_LOOP",
    "sound_stop": "SFX_CRYO_BEAM_END"
}
```
*(Note: The `specialEffect` block is an example of extending stats for unique weapon behaviors; game systems would need to be programmed to interpret and apply such custom effects.)*

**2. Generating a New Bot Configuration:**

> "Create a 'bot configuration' JSON object for a fast, hit-and-run enemy bot named 'Shadow Striker'. It should use the 'chassis_light_stealth' (you might need to generate this chassis first if it doesn't exist), two 'weapon_ion_pistol' (again, generate if needed), and an 'engine_overdrive_s'. Its AI behavior should be 'hit_and_run_harasser'. Give it a dark grey primary color. Follow `SCHEMA_BOTS.md`."

**3. Generating a New Map:**

> "Design a 'map' JSON object for a compact arena (approx 1500x1000 units) called 'Hazard Lab' with a 'grid' background. Include 3-4 'static_box' obstacles with industrial sprites/colors. One obstacle should be a 'dynamic_cylinder' representing an explosive barrel. Define two player start positions. Follow `SCHEMA_MAPS.md`."


## Conceptual Automated Content Generation Pipeline

This outlines a hypothetical workflow for integrating LLM-generated content into the game, possibly via a debug menu or an external tool:

1.  **Prompt Input:** Developer or authorized user provides a text prompt (like examples above) via an in-game interface or a separate web tool.
2.  **API Request:** The game client or tool sends the prompt and the relevant schema (or a link/reference to it) to an LLM API (e.g., OpenAI GPT API, Google Gemini API). The request would specify that the output must be JSON.
3.  **LLM Processing:** The LLM processes the prompt and schema, generating a JSON string as output.
4.  **JSON Parsing & Validation:**
    *   The game receives the JSON string from the LLM.
    *   It attempts to parse the string: `JSON.parse(llmOutputString)`.
    *   **Crucial Step: Schema Validation.** The parsed JavaScript object should be validated against the target schema (Parts, Bot Configs, or Maps). This can be done using a JSON Schema validator library (e.g., Ajv) or through custom validation logic in `DataManager.js` (basic checks are already being added).
    *   If parsing or validation fails, provide feedback to the user/developer to refine the prompt or indicate an LLM error.
5.  **Dynamic Loading:**
    *   If the JSON is valid, the game calls the appropriate method in `DataManager.js`:
        *   `dataManager.loadPartFromObject(parsedJsonData)`
        *   `dataManager.loadBotConfigFromObject(parsedJsonData)`
        *   `dataManager.loadMapFromObject(parsedJsonData)`
6.  **Content Availability & Feedback:**
    *   If the `DataManager` method succeeds, the new content is added to the game's data stores.
    *   The game UI should then reflect this new content:
        *   New parts might appear in a Bot Builder screen.
        *   New bot configurations might become selectable for players or added to enemy pools.
        *   New maps might become selectable for matches.
    *   Provide success feedback to the user/developer.
7.  **Persistence (Optional):**
    *   The newly loaded content is currently in-memory. For persistence, the game would need a mechanism to save this new JSON data back to the server or local storage (e.g., allow exporting the generated JSON or saving it to user-specific files).

**Considerations for LLM Integration:**

*   **Prompt Engineering:** Clear, concise prompts that explicitly reference the schema documents are key to getting good results.
*   **Schema Adherence:** LLMs may sometimes produce nearly-correct JSON that slightly deviates from the schema (e.g., wrong data type, missing required field). Robust validation is essential.
*   **Iteration & Refinement:** Expect to iterate on prompts and potentially fine-tune LLM parameters if available.
*   **Creativity vs. Constraints:** Balance the LLM's creative potential with the game's mechanical and thematic constraints defined in the schemas.
*   **Human Review:** For production content, a human review step is highly recommended to ensure quality, balance, and appropriateness, especially if content is generated by end-users.
*   **Cost and Rate Limits:** If using a commercial LLM API, be mindful of API call costs and rate limits.

This framework allows for rapid content prototyping and expansion, leveraging the generative capabilities of LLMs while maintaining structure through defined schemas.
