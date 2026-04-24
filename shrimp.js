import * as THREE from 'three';

export class ShrimpSwarm {
  constructor(scene, count) {
    this.count = count;
    this.shrimpArray = [];
    
    // 1. Load the Texture
    const loader = new THREE.TextureLoader();
    // Ensure the path matches where you saved your shrimp image!
    this.shrimpTexture = loader.load('assets/shrimp.png'); 
    
    // Keep pixels sharp (No blurry shrimp!)
    this.shrimpTexture.magFilter = THREE.NearestFilter;
    this.shrimpTexture.minFilter = THREE.NearestFilter;

    this.init(scene);
  }

  init(scene) {
    // 2. Create a shared material for all shrimp
    const material = new THREE.SpriteMaterial({
      map: this.shrimpTexture,
      transparent: true,
      depthTest: true,
      depthWrite: false, // Makes them overlap in a 'cursed' cluster way
      opacity: 0.9
    });

    for (let i = 0; i < this.count; i++) {
      const sprite = new THREE.Sprite(material.clone());
      this.resetShrimp(sprite);
      sprite.visible = true; // Force visibility on init
      scene.add(sprite);
      this.shrimpArray.push(sprite);
    }
  }

  // Helper to re-spawn a shrimp at a random location
  resetShrimp(sprite) {
    sprite.position.x = (Math.random() - 0.5) * 100;
    sprite.position.z = (Math.random() - 0.5) * 100;
    
    // Crank the size up! If the PNG has whitespace, 1.5 is too small.
    // Let's try a range of 5 to 8.
    const s = 2.0 + Math.random() * 1.5; 
    sprite.scale.set(s, s, 1);
    sprite.material.opacity = 0.4 + (s / 3.5) * 0.6; // Smaller ones are more "ghostly"
    sprite.userData.grip = 0.005 + Math.random() * 0.015;
  }

  update(sim, oceanPositions) {
    // Only update if the first shrimp is visible (GUI toggle check)
    if (!this.shrimpArray[0].visible) return;

    const SIZE = sim.size;

    for (let i = 0; i < this.count; i++) {
      if (this.shrimpArray.length === 0 || !this.shrimpArray[0].visible) return;
      const sprite = this.shrimpArray[i];

      // --- 1. RANDOM DISAPPEARANCE ---
      // 0.1% chance per frame to vanish and re-appear elsewhere
      if (Math.random() < 0.0005) {
        this.resetShrimp(sprite);
      }

      // --- 2. PHYSICS MAPPING ---
      let gx = Math.floor(((sprite.position.x + 50) / 100) * SIZE);
      let gz = Math.floor(((sprite.position.z + 50) / 100) * SIZE);
      
      // Wrap indices for safety
      gx = (gx + SIZE) % SIZE;
      gz = (gz + SIZE) % SIZE;
      
      const idx = (gz * SIZE + gx) * 2;
      const u = sim.uSp ? sim.uSp[idx] : 0;
      const v = sim.vSp ? sim.vSp[idx] : 0;
      
      // Calculate local current speed
      const currentSpeed = Math.sqrt(u * u + v * v);

      // --- 3. THE 'INERTIA' LOGIC ---
      // Shrimp only moves if the water is moving faster than its 'grip'
      if (currentSpeed > sprite.userData.grip) {
        // Lower this number to make them drift smoothly
        sprite.position.x += u * 0.25; 
        sprite.position.z += v * 0.25; 
      }

      // --- 4. EDGE CHECK ---
      // If they drift off the map, re-spawn them randomly
      if (Math.abs(sprite.position.x) > 52 || Math.abs(sprite.position.z) > 52) {
        this.resetShrimp(sprite);
      }

      // --- 5. VERTICAL POSITIONING ---
      // Match the 3D 'dent' of the ocean surface
      const meshIdx = (gz * SIZE + gx) * 3;
      // We add +1.0 so they hover slightly above the mesh surface
      sprite.position.y = oceanPositions[meshIdx + 2] + 1.0;
    }
  }

  toggle(visible) {
    this.shrimpArray.forEach(s => s.visible = visible);
  }
}