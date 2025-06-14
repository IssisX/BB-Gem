class DataManager {
    constructor() {
        this.parts = {
            chassis: [],
            weapons: [],
            armor: [],
            engines: []
        };
        this.partsById = new Map();
        this.botConfigsById = new Map(); // For bot configurations
        this.mapsById = new Map();       // For map data
    }

    async loadAllData() {
        try {
            await this.loadPartsData(['chassis', 'weapons', 'armor', 'engines']);
            await this.loadBotConfigs(['player_presets', 'enemy_lineup']); // Pass filenames without .json
            await this.loadMapData(['arena_basic']); // Pass filenames without .json
            console.log("All game data loaded successfully.");
        } catch (error) {
            console.error("Error loading game data:", error);
            // Handle critical error, maybe show an error screen to the user
        }
    }

    async loadPartsData(categories = ['chassis', 'weapons', 'armor']) {
        const loadPromises = categories.map(category =>
            fetch(`./data/parts/${category}.json`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status} for ${category}.json`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.parts[category] = data;
                    data.forEach(part => {
                        if (this.partsById.has(part.id)) {
                            console.warn(`Duplicate part ID found: ${part.id}. Overwriting.`);
                        }
                        this.partsById.set(part.id, { ...part, category }); // Store category with part for easy access
                    });
                    console.log(`${category}.json loaded and parsed successfully.`);
                })
                .catch(error => {
                    console.error(`Failed to load or parse ${category}.json:`, error);
                    this.parts[category] = []; // Ensure it's an empty array on error
                })
        );

        await Promise.all(loadPromises);
        // console.log("Parts data loaded:", this.parts);
        // console.log("Parts by ID map populated:", this.partsById.size, "entries");
    }

    async loadBotConfigs(filenames = []) {
        const loadPromises = filenames.map(filename =>
            fetch(`./data/bots/${filename}.json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${filename}.json`);
                    return response.json();
                })
                .then(dataArray => { // Assuming each file contains an array of bot configs
                    dataArray.forEach(botConfig => {
                        if (this.botConfigsById.has(botConfig.botId)) {
                            console.warn(`Duplicate botConfig ID found: ${botConfig.botId}. Overwriting.`);
                        }
                        this.botConfigsById.set(botConfig.botId, botConfig);
                    });
                    console.log(`${filename}.json loaded and parsed successfully.`);
                })
                .catch(error => console.error(`Failed to load or parse ${filename}.json:`, error))
        );
        await Promise.all(loadPromises);
        // console.log("Bot configs loaded:", this.botConfigsById.size, "entries");
    }

    async loadMapData(filenames = []) {
        const loadPromises = filenames.map(filename =>
            fetch(`./data/maps/${filename}.json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${filename}.json`);
                    return response.json();
                })
                .then(mapData => { // Assuming each file contains a single map object
                    if (this.mapsById.has(mapData.mapId)) {
                        console.warn(`Duplicate mapId found: ${mapData.mapId}. Overwriting.`);
                    }
                    this.mapsById.set(mapData.mapId, mapData);
                    console.log(`${filename}.json (Map: ${mapData.mapId}) loaded successfully.`);
                })
                .catch(error => console.error(`Failed to load or parse ${filename}.json:`, error))
        );
        await Promise.all(loadPromises);
        // console.log("Map data loaded:", this.mapsById.size, "entries");
    }

    getPartById(id) {
        const part = this.partsById.get(id);
        // if (!part) console.warn(`DataManager: Part with ID '${id}' not found.`);
        return part;
    }

    getBotConfigById(botId) {
        const config = this.botConfigsById.get(botId);
        // if (!config) console.warn(`DataManager: BotConfig with ID '${botId}' not found.`);
        return config;
    }

    getMapDataById(mapId) {
        const map = this.mapsById.get(mapId);
        // if (!map) console.warn(`DataManager: MapData with ID '${mapId}' not found.`);
        return map;
    }

    getAllParts(category) {
        if (!this.parts[category]) {
            // console.warn(`DataManager: Category '${category}' not found or no parts loaded.`);
            return [];
        }
        return this.parts[category];
    }

    // Example: Get parts of a specific type within a category, e.g., "small_weapon" from "weapons"
    getPartsByType(category, type) {
        if (!this.parts[category]) return [];
        return this.parts[category].filter(part => part.type === type);
    }

    // --- Methods for loading from JSON objects at runtime ---

    loadPartFromObject(partData) {
        // TODO: Implement robust JSON schema validation here
        if (!partData || typeof partData.id !== 'string' || typeof partData.category !== 'string' || typeof partData.name !== 'string') {
            console.error("DataManager: Invalid partData object. Missing id, category, or name.", partData);
            return false;
        }
        if (!this.parts[partData.category]) {
            console.warn(`DataManager: Category '${partData.category}' does not exist. Creating it for part ${partData.id}.`);
            this.parts[partData.category] = [];
        }

        const existingPartIndex = this.parts[partData.category].findIndex(p => p.id === partData.id);
        if (existingPartIndex !== -1) {
            console.warn(`DataManager: Part ID ${partData.id} already exists in category ${partData.category}. Overwriting.`);
            this.parts[partData.category][existingPartIndex] = partData;
        } else {
            this.parts[partData.category].push(partData);
        }

        this.partsById.set(partData.id, { ...partData }); // Ensure category is part of partData if used directly
        console.log(`Part ${partData.id} (${partData.name}) loaded from object into category ${partData.category}.`);
        return true;
    }

    loadBotConfigFromObject(botConfigData) {
        // TODO: Implement robust JSON schema validation here
        if (!botConfigData || typeof botConfigData.botId !== 'string' || typeof botConfigData.name !== 'string' || typeof botConfigData.chassisId !== 'string') {
            console.error("DataManager: Invalid botConfigData object. Missing botId, name, or chassisId.", botConfigData);
            return false;
        }

        if (this.botConfigsById.has(botConfigData.botId)) {
            console.warn(`Duplicate botConfig ID found: ${botConfigData.botId}. Overwriting with object data.`);
        }
        this.botConfigsById.set(botConfigData.botId, botConfigData);
        console.log(`BotConfig ${botConfigData.botId} (${botConfigData.name}) loaded from object.`);
        return true;
    }

    loadMapFromObject(mapData) {
        // TODO: Implement robust JSON schema validation here
        if (!mapData || typeof mapData.mapId !== 'string' || typeof mapData.name !== 'string' || !mapData.dimensions) {
            console.error("DataManager: Invalid mapData object. Missing mapId, name, or dimensions.", mapData);
            return false;
        }

        if (this.mapsById.has(mapData.mapId)) {
            console.warn(`Duplicate mapId found: ${mapData.mapId}. Overwriting with object data.`);
        }
        this.mapsById.set(mapData.mapId, mapData);
        console.log(`Map ${mapData.mapId} (${mapData.name}) loaded from object.`);
        return true;
    }
}

export default DataManager;
