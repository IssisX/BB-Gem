export class BotBuilder {
    constructor(canvas, settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.selectedPart = null;
        this.draggedPart = null;
        this.isDragging = false;
        this.lastTouchPos = { x: 0, y: 0 };
        
        this.partLibrary = {
            chassis: [
                { id: 'light_chassis', name: 'Light Chassis', icon: '🏎️', stats: { speed: 5, armor: 2, energy: 4 } },
                { id: 'medium_chassis', name: 'Medium Chassis', icon: '🚗', stats: { speed: 3, armor: 4, energy: 3 } },
                { id: 'heavy_chassis', name: 'Heavy Chassis', icon: '🚚', stats: { speed: 1, armor: 5, energy: 2 } },
                { id: 'tank_chassis', name: 'Tank Chassis', icon: '🚜', stats: { speed: 2, armor: 5, energy: 1 } }
            ],
            weapons: [
                { id: 'laser_cannon', name: 'Laser Cannon', icon: '🔫', stats: { damage: 4, range: 5, energy: 3 } },
                { id: 'plasma_rifle', name: 'Plasma Rifle', icon: '🔫', stats: { damage: 5, range: 4, energy: 4 } },
                { id: 'missile_launcher', name: 'Missile Launcher', icon: '🚀', stats: { damage: 5, range: 5, energy: 5 } },
                { id: 'chaingun', name: 'Chaingun', icon: '🔫', stats: { damage: 3, range: 3, energy: 2 } }
            ],
            armor: [
                { id: 'light_armor', name: 'Light Armor', icon: '🛡️', stats: { armor: 2, speed: 0, energy: 0 } },
                { id: 'medium_armor', name: 'Medium Armor', icon: '🛡️', stats: { armor: 3, speed: -1, energy: 0 } },
                { id: 'heavy_armor', name: 'Heavy Armor', icon: '🛡️', stats: { armor: 5, speed: -2, energy: 0 } },
                { id: 'energy_shield', name: 'Energy Shield', icon: '🛡️', stats: { armor: 4, speed: 0, energy: 2 } }
            ]
        };
        
        this.currentBot = this.createDefaultBot();
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.populatePartsGrid();
        this.render();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Set canvas style size back to original
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    setupEventListeners() {
        // Touch events for canvas
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Mouse events for desktop
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Builder controls
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="rotate-left"]')) {
                this.rotatePart(-90);
            } else if (e.target.matches('[data-action="rotate-right"]')) {
                this.rotatePart(90);
            } else if (e.target.matches('[data-action="reset"]')) {
                this.resetBot();
            }
        });
        
        // Part selection
        document.addEventListener('click', (e) => {
            if (e.target.matches('.part-item')) {
                this.selectPart(e.target.dataset.partId);
            }
        });
        
        // Category switching
        document.addEventListener('click', (e) => {
            if (e.target.matches('.category-btn')) {
                this.switchCategory(e.target.dataset.category);
            }
        });
        
        // Custom event for initialization
        document.addEventListener('initBotBuilder', (e) => {
            this.settings = e.detail.settings;
            this.render();
        });
        
        // Save bot design
        document.addEventListener('saveBotDesign', () => {
            this.saveBotDesign();
        });
    }

    createDefaultBot() {
        const bot = {
            chassis: this.partLibrary.chassis[1], // Medium chassis
            weapons: [this.partLibrary.weapons[0]], // Laser cannon
            armor: [this.partLibrary.armor[0]], // Light armor
            position: { x: 0, y: 0 },
            rotation: 0,
        };
        bot.stats = this.calculateStats(bot);
        return bot;
    }

    calculateStats(bot) {
        const botToStat = bot || this.currentBot;
        let stats = { speed: 0, armor: 0, energy: 0, damage: 0, range: 0 };
        
        if (!botToStat) return stats;

        // Add chassis stats
        if (botToStat.chassis) {
            Object.keys(botToStat.chassis.stats).forEach(key => {
                stats[key] = (stats[key] || 0) + botToStat.chassis.stats[key];
            });
        }
        
        // Add weapon stats
        if (botToStat.weapons) {
            botToStat.weapons.forEach(weapon => {
                Object.keys(weapon.stats).forEach(key => {
                    stats[key] = (stats[key] || 0) + weapon.stats[key];
                });
            });
        }
        
        // Add armor stats
        if (botToStat.armor) {
            botToStat.armor.forEach(armor => {
                Object.keys(armor.stats).forEach(key => {
                    stats[key] = (stats[key] || 0) + armor.stats[key];
                });
            });
        }
        
        return stats;
    }

    populatePartsGrid() {
        const partsGrid = document.getElementById('parts-grid');
        const activeCategory = document.querySelector('.category-btn.active');
        const category = activeCategory ? activeCategory.dataset.category : 'chassis';
        
        partsGrid.innerHTML = '';
        
        this.partLibrary[category].forEach(part => {
            const partElement = document.createElement('div');
            partElement.className = 'part-item';
            partElement.dataset.partId = part.id;
            partElement.innerHTML = `
                <div class="part-icon">${part.icon}</div>
                <div class="part-name">${part.name}</div>
            `;
            
            partsGrid.appendChild(partElement);
        });
    }

    switchCategory(category) {
        // Update active category button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Update parts grid
        this.populatePartsGrid();
    }

    selectPart(partId) {
        // Find the part in the library
        let selectedPart = null;
        Object.values(this.partLibrary).forEach(category => {
            const part = category.find(p => p.id === partId);
            if (part) selectedPart = part;
        });
        
        if (selectedPart) {
            this.selectedPart = selectedPart;
            
            // Visual feedback
            document.querySelectorAll('.part-item').forEach(item => {
                item.classList.remove('selected');
            });
            document.querySelector(`[data-part-id="${partId}"]`).classList.add('selected');
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.startDrag(x, y);
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.isDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            this.continueDrag(x, y);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.endDrag();
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.startDrag(x, y);
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.continueDrag(x, y);
        }
    }

    handleMouseUp(e) {
        this.endDrag();
    }

    startDrag(x, y) {
        this.lastTouchPos = { x, y };
        
        // Check if clicking on an existing part
        const clickedPart = this.getPartAtPosition(x, y);
        if (clickedPart) {
            this.isDragging = true;
            this.draggedPart = clickedPart;
        } else if (this.selectedPart) {
            // Start placing a new part
            this.isDragging = true;
            this.draggedPart = {
                ...this.selectedPart,
                position: { x: x - this.canvas.width/2, y: y - this.canvas.height/2 },
                rotation: 0,
                isNew: true
            };
        }
    }

    continueDrag(x, y) {
        if (this.isDragging && this.draggedPart) {
            this.draggedPart.position = {
                x: x - this.canvas.width/2,
                y: y - this.canvas.height/2
            };
            this.render();
        }
    }

    endDrag() {
        if (this.isDragging && this.draggedPart) {
            if (this.draggedPart.isNew) {
                // Add new part to bot
                this.addPartToBot(this.draggedPart);
            }
            
            this.isDragging = false;
            this.draggedPart = null;
            this.render();
        }
    }

    addPartToBot(part) {
        const partType = this.getPartType(part);
        
        if (partType === 'chassis') {
            this.currentBot.chassis = part;
        } else if (partType === 'weapons') {
            // Allow multiple weapons but limit to 2
            if (this.currentBot.weapons.length < 2) {
                this.currentBot.weapons.push(part);
            }
        } else if (partType === 'armor') {
            // Allow multiple armor pieces but limit to 3
            if (this.currentBot.armor.length < 3) {
                this.currentBot.armor.push(part);
            }
        }
        
        // Recalculate stats
        this.currentBot.stats = this.calculateStats();
    }

    getPartType(part) {
        for (const [category, parts] of Object.entries(this.partLibrary)) {
            if (parts.some(p => p.id === part.id)) {
                return category;
            }
        }
        return null;
    }

    getPartAtPosition(x, y) {
        // Simple collision detection - return the first part found
        const canvasX = x - this.canvas.width/2;
        const canvasY = y - this.canvas.height/2;
        
        // Check chassis
        if (this.currentBot.chassis && this.isPointInPart(canvasX, canvasY, this.currentBot.chassis)) {
            return this.currentBot.chassis;
        }
        
        // Check weapons
        for (const weapon of this.currentBot.weapons) {
            if (this.isPointInPart(canvasX, canvasY, weapon)) {
                return weapon;
            }
        }
        
        // Check armor
        for (const armor of this.currentBot.armor) {
            if (this.isPointInPart(canvasX, canvasY, armor)) {
                return armor;
            }
        }
        
        return null;
    }

    isPointInPart(x, y, part) {
        const partSize = 40;
        const partPos = part.position || { x: 0, y: 0 };
        
        return x >= partPos.x - partSize/2 && x <= partPos.x + partSize/2 &&
               y >= partPos.y - partSize/2 && y <= partPos.y + partSize/2;
    }

    rotatePart(degrees) {
        if (this.selectedPart) {
            // For now, just provide visual feedback
            console.log(`Rotating part ${degrees} degrees`);
        }
    }

    resetBot() {
        this.currentBot = this.createDefaultBot();
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw background grid
        this.drawGrid(ctx, width, height);
        
        // Draw bot center
        ctx.save();
        ctx.translate(width/2, height/2);
        
        // Draw chassis
        if (this.currentBot.chassis) {
            this.drawPart(ctx, this.currentBot.chassis, 0, 0, 60, '#00ffff');
        }
        
        // Draw weapons
        this.currentBot.weapons.forEach((weapon, index) => {
            const angle = (index * Math.PI / 2) + Math.PI/4;
            const radius = 40;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            this.drawPart(ctx, weapon, x, y, 30, '#ff00ff');
        });
        
        // Draw armor
        this.currentBot.armor.forEach((armor, index) => {
            const angle = index * Math.PI * 2 / 3;
            const radius = 70;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            this.drawPart(ctx, armor, x, y, 25, '#ffff00');
        });
        
        // Draw dragged part
        if (this.isDragging && this.draggedPart) {
            this.drawPart(ctx, this.draggedPart, 
                this.draggedPart.position.x, 
                this.draggedPart.position.y, 
                40, '#ffffff', 0.7);
        }
        
        ctx.restore();
        
        // Draw stats panel
        this.drawStatsPanel(ctx, width, height);
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const gridSize = 20;
        
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    drawPart(ctx, part, x, y, size, color, alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        
        // Draw part background
        ctx.fillStyle = color + '20';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(-size/2, -size/2, size, size, 8);
        ctx.fill();
        ctx.stroke();
        
        // Draw part icon
        ctx.fillStyle = color;
        ctx.font = `${size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(part.icon, 0, 0);
        
        // Draw part name
        ctx.fillStyle = color;
        ctx.font = '10px Arial';
        ctx.fillText(part.name, 0, size/2 + 15);
        
        ctx.restore();
    }

    drawStatsPanel(ctx, width, height) {
        const panelWidth = 200;
        const panelHeight = 120;
        const panelX = width - panelWidth - 10;
        const panelY = 10;
        
        // Draw panel background
        ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Draw stats
        ctx.fillStyle = '#00ffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        const stats = this.currentBot.stats;
        const statNames = ['Speed', 'Armor', 'Energy', 'Damage', 'Range'];
        const statKeys = ['speed', 'armor', 'energy', 'damage', 'range'];
        
        statNames.forEach((name, index) => {
            const value = stats[statKeys[index]] || 0;
            const y = panelY + 20 + (index * 18);
            
            ctx.fillText(`${name}: ${value}`, panelX + 10, y);
            
            // Draw stat bar
            const barWidth = 100;
            const barHeight = 8;
            const barX = panelX + 90;
            const barY = y - 6;
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#00ffff';
            const fillWidth = Math.min(barWidth, (value / 10) * barWidth);
            ctx.fillRect(barX, barY, fillWidth, barHeight);
        });
    }

    saveBotDesign() {
        const design = {
            name: `Bot_${Date.now()}`,
            design: JSON.parse(JSON.stringify(this.currentBot)),
            stats: this.currentBot.stats,
            created: new Date()
        };
        
        // Emit event to save the design
        const event = new CustomEvent('botDesignSaved', { detail: design });
        document.dispatchEvent(event);
        
        console.log('Bot design saved:', design);
    }

    getBotDesign() {
        const design = {
            name: `Bot_${Date.now()}`,
            design: JSON.parse(JSON.stringify(this.currentBot)),
            stats: this.currentBot.stats,
            created: new Date()
        };
        return design;
    }

    loadBotDesign(design) {
        this.currentBot = JSON.parse(JSON.stringify(design.design));
        this.render();
    }

    cleanup() {
        // Remove event listeners and clean up resources
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    }
}

// Initialize bot builder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('builder-canvas');
    if (canvas) {
        window.botBuilder = new BotBuilder(canvas, {});
    }
});