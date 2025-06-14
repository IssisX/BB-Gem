import Dexie from 'dexie';

export class StorageManager {
    constructor() {
        this.db = new Dexie('BattleBotsDB');
        this.setupDatabase();
    }

    setupDatabase() {
        this.db.version(1).stores({
            settings: 'id, data',
            bots: '++id, name, design, stats, created',
            gameResults: '++id, result, timestamp, duration',
            achievements: '++id, type, unlocked, timestamp'
        });
    }

    async init() {
        try {
            await this.db.open();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }

    async saveSettings(settings) {
        try {
            await this.db.settings.put({
                id: 'user_settings',
                data: settings
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    async getSettings() {
        try {
            const record = await this.db.settings.get('user_settings');
            return record ? record.data : null;
        } catch (error) {
            console.error('Failed to load settings:', error);
            return null;
        }
    }

    async saveBotDesign(bot) {
        try {
            const existingBot = await this.db.bots.where('name').equals(bot.name).first();
            
            if (existingBot) {
                await this.db.bots.update(existingBot.id, {
                    design: bot.design,
                    stats: bot.stats,
                    created: new Date()
                });
            } else {
                await this.db.bots.add({
                    name: bot.name,
                    design: bot.design,
                    stats: bot.stats,
                    created: new Date()
                });
            }
        } catch (error) {
            console.error('Failed to save bot design:', error);
        }
    }

    async getBotDesigns() {
        try {
            return await this.db.bots.orderBy('created').reverse().toArray();
        } catch (error) {
            console.error('Failed to load bot designs:', error);
            return [];
        }
    }

    async saveGameResult(result) {
        try {
            await this.db.gameResults.add({
                result: result,
                timestamp: new Date(),
                duration: result.duration
            });

            // Check for achievements
            this.checkAchievements(result);
        } catch (error) {
            console.error('Failed to save game result:', error);
        }
    }

    async getGameStats() {
        try {
            const results = await this.db.gameResults.toArray();
            
            const stats = {
                totalGames: results.length,
                victories: results.filter(r => r.result.victory).length,
                defeats: results.filter(r => r.result.victory === false).length,
                totalDamage: results.reduce((sum, r) => sum + (r.result.damage || 0), 0),
                averageAccuracy: results.reduce((sum, r) => sum + (r.result.accuracy || 0), 0) / results.length,
                bestTime: Math.min(...results.map(r => r.result.timeSeconds || Infinity)),
                totalPlayTime: results.reduce((sum, r) => sum + (r.duration || 0), 0)
            };
            
            return stats;
        } catch (error) {
            console.error('Failed to load game stats:', error);
            return null;
        }
    }

    async checkAchievements(result) {
        const achievements = [
            {
                id: 'first_victory',
                name: 'First Victory',
                description: 'Win your first battle',
                condition: (result) => result.victory
            },
            {
                id: 'perfect_accuracy',
                name: 'Sharpshooter',
                description: 'Achieve 100% accuracy in a battle',
                condition: (result) => result.accuracy >= 100
            },
            {
                id: 'quick_victory',
                name: 'Lightning Strike',
                description: 'Win a battle in under 30 seconds',
                condition: (result) => result.victory && result.timeSeconds < 30
            },
            {
                id: 'damage_dealer',
                name: 'Damage Dealer',
                description: 'Deal over 150 damage in a single battle',
                condition: (result) => result.damage > 150
            }
        ];

        for (const achievement of achievements) {
            if (achievement.condition(result)) {
                const existing = await this.db.achievements.where('type').equals(achievement.id).first();
                
                if (!existing) {
                    await this.db.achievements.add({
                        type: achievement.id,
                        unlocked: true,
                        timestamp: new Date()
                    });
                    
                    // Show achievement notification
                    this.showAchievementNotification(achievement);
                }
            }
        }
    }

    showAchievementNotification(achievement) {
        // Create achievement notification
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">🏆</div>
            <div class="achievement-text">
                <div class="achievement-title">${achievement.name}</div>
                <div class="achievement-description">${achievement.description}</div>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ffff;
            border-radius: 8px;
            padding: 1rem;
            color: #00ffff;
            font-family: inherit;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Animate out after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    async clearAllData() {
        try {
            await this.db.delete();
            await this.db.open();
            console.log('All data cleared');
        } catch (error) {
            console.error('Failed to clear data:', error);
        }
    }

    async exportData() {
        try {
            const data = {
                settings: await this.db.settings.toArray(),
                bots: await this.db.bots.toArray(),
                gameResults: await this.db.gameResults.toArray(),
                achievements: await this.db.achievements.toArray()
            };
            
            return JSON.stringify(data);
        } catch (error) {
            console.error('Failed to export data:', error);
            return null;
        }
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Clear existing data
            await this.db.transaction('rw', this.db.settings, this.db.bots, this.db.gameResults, this.db.achievements, async () => {
                await this.db.settings.clear();
                await this.db.bots.clear();
                await this.db.gameResults.clear();
                await this.db.achievements.clear();
                
                // Import new data
                if (data.settings) await this.db.settings.bulkAdd(data.settings);
                if (data.bots) await this.db.bots.bulkAdd(data.bots);
                if (data.gameResults) await this.db.gameResults.bulkAdd(data.gameResults);
                if (data.achievements) await this.db.achievements.bulkAdd(data.achievements);
            });
            
            console.log('Data imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
}

