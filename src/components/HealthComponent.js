const Component = require('../Component');

class HealthComponent extends Component {
  constructor(maxHealth = 100, damageLevels = 3) { // damageLevels indicates how many stages of visual damage
    super();
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
    this.damageLevels = damageLevels; // e.g., 3 means 0 (no damage), 1 (light), 2 (heavy)
    this.currentDamageLevel = 0; // Current visual damage state
  }

  takeDamage(amount) {
    if (!this.isAlive()) return; // Cannot take damage if already dead

    this.currentHealth -= amount;
    if (this.currentHealth < 0) {
      this.currentHealth = 0;
    }
    this.updateDamageLevel();
  }

  heal(amount) {
    if (!this.isAlive() && amount <=0) return; // Cannot heal if dead, unless it's a revive-like heal.

    this.currentHealth += amount;
    if (this.currentHealth > this.maxHealth) {
      this.currentHealth = this.maxHealth;
    }
    this.updateDamageLevel();
  }

  updateDamageLevel() {
    if (this.maxHealth <= 0 || this.damageLevels <=1 ) { // No damage levels if no health or only one state
        this.currentDamageLevel = 0;
        return;
    }
    const healthPercentage = this.currentHealth / this.maxHealth;
    // Example: if damageLevels = 3:
    // health > 66% -> level 0 (no damage)
    // health 33% - 66% -> level 1 (light damage)
    // health < 33% -> level 2 (heavy damage)
    // health == 0 -> still level 2 (or a specific "destroyed" level if needed)

    if (healthPercentage > 0.66) {
        this.currentDamageLevel = 0;
    } else if (healthPercentage > 0.33) {
        this.currentDamageLevel = 1;
    } else {
        this.currentDamageLevel = 2;
    }
    // Ensure currentDamageLevel doesn't exceed max defined by damageLevels (e.g. if damageLevels is 2, max level is 1)
    // This simple logic assumes damageLevels = 3. A more generic calculation:
    // this.currentDamageLevel = Math.min(this.damageLevels - 1, Math.floor((1 - healthPercentage) * this.damageLevels));
    // For healthPercentage = 1 (full), (1-1)*3 = 0. Level 0.
    // For healthPercentage = 0.5, (1-0.5)*3 = 1.5. Level 1.
    // For healthPercentage = 0.1, (1-0.1)*3 = 2.7. Level 2.
    // For healthPercentage = 0, (1-0)*3 = 3. Level 2 (clamped).
    const calculatedLevel = Math.floor((1 - healthPercentage) * (this.damageLevels -1)); // damageLevels-1 because level is 0-indexed
    this.currentDamageLevel = Math.min(this.damageLevels -1, calculatedLevel );
    if (this.currentHealth === 0 && this.damageLevels > 1) { // If dead, show max damage level
        this.currentDamageLevel = this.damageLevels - 1;
    }


  }

  isAlive() {
    return this.currentHealth > 0;
  }
}

module.exports = HealthComponent;
