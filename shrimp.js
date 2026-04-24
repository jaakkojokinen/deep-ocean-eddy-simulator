import * as THREE from 'three';

export class ShrimpSwarm {
  constructor(scene, count) {
    this.count = count;
    this.shrimpArray = [];
    
    const loader = new THREE.TextureLoader();
    this.shrimpTexture = loader.load('assets/shrimp.png'); 
    
    this.shrimpTexture.magFilter = THREE.NearestFilter;
    this.shrimpTexture.minFilter = THREE.NearestFilter;

    this.init(scene);
  }

  init(scene) {
    const material = new THREE.SpriteMaterial({
      map: this.shrimpTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false, 
      opacity: 0.9
    });

    for (let i = 0; i < this.count; i++) {
      // Cloning material so each can have its own opacity
      const sprite = new THREE.Sprite(material.clone());
      this.resetShrimp(sprite);
      sprite.visible = true; 
      scene.add(sprite);
      this.shrimpArray.push(sprite);
    }
  }

  resetShrimp(sprite) {
    // Randomize position
    sprite.position.x = (Math.random() - 0.5) * 100;
    sprite.position.z = (Math.random() - 0.5) * 100;
    
    // Scale
    const s = 1.8 + Math.random() * 1.2; 
    sprite.scale.set(s, s, 1);
    
    // Opacity based on scale
    sprite.material.opacity = 0.5 + (s / 3.0) * 0.4;

    // --- NEW INERTIA LOGIC ---
    // 90% of shrimp have very low grip (they flow immediately)
    // 10% are 'stubborn' and stay static until hit by a strong vortex
    if (Math.random() > 0.1) {
      sprite.userData.grip = 0.001; // Easy flow
    } else {
      sprite.userData.grip = 0.03;  // Stubborn/Static
    }
  }

  update(sim, oceanPositions) {
    if (this.shrimpArray.length === 0 || !this.shrimpArray[0].visible) return;

    const SIZE = sim.size;

    for (let i = 0; i < this.count; i++) {
      const sprite = this.shrimpArray[i];

      // --- 1. SLOWER RANDOM RE-SPAWN ---
      // Keeping them on screen longer so they can complete a journey
      if (Math.random() < 0.0003) {
        this.resetShrimp(sprite);
      }

      // --- 2. PHYSICS MAPPING ---
      let gx = Math.floor(((sprite.position.x + 50) / 100) * SIZE);
      let gz = Math.floor(((sprite.position.z + 50) / 100) * SIZE);
      
      gx = (gx + SIZE) % SIZE;
      gz = (gz + SIZE) % SIZE;
      
      const idx = (gz * SIZE + gx) * 2;
      const u = sim.uSp ? sim.uSp[idx] : 0;
      const v = sim.vSp ? sim.vSp[idx] : 0;
      const currentSpeed = Math.sqrt(u * u + v * v);

      // --- 3. MOVEMENT ---
      if (currentSpeed > sprite.userData.grip) {
        sprite.position.x += u * 0.25; 
        sprite.position.z += v * 0.25; 
      }

      // --- 4. EDGE CHECK ---
      // Wrap-around or Reset? Let's use Reset for a more 'migration' feel
      if (Math.abs(sprite.position.x) > 52 || Math.abs(sprite.position.z) > 52) {
        this.resetShrimp(sprite);
      }

      // --- 5. VERTICAL POSITIONING ---
      const meshIdx = (gz * SIZE + gx) * 3;
      sprite.position.y = oceanPositions[meshIdx + 2] + 1.0;
    }
  }

  toggle(visible) {
    this.shrimpArray.forEach(s => s.visible = visible);
  }
}