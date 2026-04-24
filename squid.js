import * as THREE from 'three';

export class GiantSquid {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.sprite = null;
    
    const loader = new THREE.TextureLoader();
    this.texture = loader.load('assets/squid.png');
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0
    });
  }

  spawn() {
    if (this.active) return;
    
    this.sprite = new THREE.Sprite(this.material.clone());
    // Start at a random edge
    const side = Math.random() > 0.5 ? 1 : -1;
    this.sprite.position.set(side * 55, 0, (Math.random() - 0.5) * 100);
    
    // Make it HUGE compared to shrimp
    this.sprite.scale.set(50, 50, 1);
    this.sprite.material.opacity = 0;
    
    this.scene.add(this.sprite);
    this.active = true;
    console.log("⚠️ RARE SIGHTING: THE GIANT SQUID HAS ENTERED THE EDDY.");
  }

  update(sim, oceanPositions, enabled) {
    // 1. Rarity Logic: 0.01% chance to spawn if enabled and not currently active
    if (enabled && !this.active && Math.random() < 0.0005) {
      this.spawn();
    }

    if (!this.active || !this.sprite) return;

    const SIZE = sim.size;
    const speedMultiplier = 10.0; // Slower than shrimp, it has mass

    // 2. Physics Lookup
    let gx = Math.floor(((this.sprite.position.x + 50) / 100) * SIZE);
    let gz = Math.floor(((this.sprite.position.z + 50) / 100) * SIZE);
    gx = (gx % SIZE + SIZE) % SIZE;
    gz = (gz % SIZE + SIZE) % SIZE;
    
    const idx = (gz * SIZE + gx) * 2;
    const u = sim.uSp ? sim.uSp[idx] : 0;
    const v = sim.vSp ? sim.vSp[idx] : 0;

    // 3. Movement
    this.sprite.position.x += u * sim.dt * speedMultiplier;
    this.sprite.position.z += v * sim.dt * speedMultiplier;

    // 4. Vertical Positioning & Rotation
    const meshIdx = (gz * SIZE + gx) * 3;
    const targetY = oceanPositions[meshIdx + 2] || 0;
    this.sprite.position.y = THREE.MathUtils.lerp(this.sprite.position.y, targetY + 5, 0.1);

    // Subtle "Breathing" Pulse
    const pulse = 1.0 + Math.sin(Date.now() * 0.0015) * 0.1;
    this.sprite.scale.set(50 * pulse, 50 * pulse, 1);

    const jitter = (Math.random() + 1.5) * 0.1;
    const flowIntensity = 35.0;
    const uData = this.sprite.userData;
    this.sprite.position.x += (u * sim.dt * flowIntensity) + jitter;
    this.sprite.position.z += (v * sim.dt * flowIntensity) + jitter;

    // Calculate how fast they are 'pogoing'
    const verticalVelocity = this.sprite.position.y - (uData.lastY || 0);
    uData.lastY = this.sprite.position.y;

    // Spin the sprite based on how fast it's being launched or dropped
    this.sprite.material.rotation += verticalVelocity * 0.5;
    
    // Fade in/out
    if (this.sprite.material.opacity < 0.8) this.sprite.material.opacity += 0.01;
    

    // 5. Despawn Logic
    if (Math.abs(this.sprite.position.x) > 60 || Math.abs(this.sprite.position.z) > 60) {
      this.scene.remove(this.sprite);
      this.active = false;
      this.sprite = null;
    }
  }
}