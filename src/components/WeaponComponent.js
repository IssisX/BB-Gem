const Component = require('../Component');

class WeaponComponent extends Component {
  constructor(
    fireRate = 1, // Shots per second
    projectileType = 'bullet',
    projectileSpeed = 20,
    projectileDamage = 10,
    projectileSize = 3, // radius for circles, or width for rects
    projectileColor = 'yellow',
    projectileLifetime = 2000, // ms
    energyCost = 0,
    spread = 0, // Angle in degrees for shot inaccuracy/spread
    renderInfo = {} // Object containing shape, color, size for projectile visuals
  ) {
    super();
    this.fireRate = fireRate;
    this.projectileType = projectileType;
    this.projectileSpeed = projectileSpeed;
    this.projectileDamage = projectileDamage;
    this.projectileSize = projectileSize; // Fallback if not in renderInfo
    this.projectileColor = projectileColor; // Fallback if not in renderInfo
    this.projectileLifetime = projectileLifetime;
    this.lastShotTime = 0;
    this.energyCost = energyCost;
    this.spread = spread;
    this.renderInfo = renderInfo; // Stores { shape, color, size, width, height, glowColor, glowSize }
  }

  canShoot(currentTime) {
    return (currentTime - this.lastShotTime) >= (1000 / this.fireRate); // 1000ms / fireRate
  }

  recordShot(currentTime) {
    this.lastShotTime = currentTime;
  }
}

module.exports = WeaponComponent;
