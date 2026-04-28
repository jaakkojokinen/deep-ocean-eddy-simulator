import * as THREE from 'three';

export class ShrimpSwarm {
  constructor(scene, maxCount = 800) {
    this.scene = scene;
    this.maxCount = maxCount;
    this.shrimpArray = [];
    
    const loader = new THREE.TextureLoader();
    this.shrimpTexture = loader.load('assets/shrimp.png'); 
    this.shrimpTexture.magFilter = THREE.NearestFilter;
    this.shrimpTexture.minFilter = THREE.NearestFilter;

    this.baseMaterial = new THREE.SpriteMaterial({
      map: this.shrimpTexture,
      transparent: true,
      depthWrite: false, 
      opacity: 0.9
    });
  }

  spawn(x, z) {
    if (this.shrimpArray.length >= this.maxCount) return;

    const sprite = new THREE.Sprite(this.baseMaterial.clone());
    // Initial Y doesn't matter, it's set in update
    sprite.position.set(x, 0, z);
    
    const s = 1.5 + Math.random() * 1.5; 
    sprite.scale.set(s, s, 1);
    
    sprite.userData = {
      // Very low grip ensures they flow with almost any movement
      grip: 0.0001, 
      age: 0,
      maxAge: 500 + Math.random() * 500,
      isDead: false
    };

    this.scene.add(sprite);
    this.shrimpArray.push(sprite);
  }

  update(sim, oceanPositions, enabled) {
    if (!this.baseMaterial) return;

    // THE MISSING GUARD: If disabled, hide all and stop logic
    if (!enabled) {
      if (this.shrimpArray.length > 0 && this.shrimpArray[0].visible) {
        this.shrimpArray.forEach(s => s.visible = false);
      }
      return;
    }
    
    // Ensure they are visible if enabled
    if (this.shrimpArray.length > 0 && !this.shrimpArray[0].visible) {
      this.shrimpArray.forEach(s => s.visible = true);
    }

    const SIZE = sim.size;
    // We match the physics speedScale (20.0) and add a little 'kick'
    const flowIntensity = 35.0; 

    // --- 1. SPATIAL SPAWNING ---
    if (this.shrimpArray.length < 50) {
        this.spawn((Math.random()-0.5)*100, (Math.random()-0.5)*100);
    }

    // --- 2. THE FLOW LOOP ---
    for (let i = this.shrimpArray.length - 1; i >= 0; i--) {
      const sprite = this.shrimpArray[i];
      const uData = sprite.userData;

      // MAP WORLD (-50 to 50) TO GRID (0 to 127)
      // This math must be exact or they won't feel the current
      let gx = Math.floor(((sprite.position.x + 50) / 100) * SIZE);
      let gz = Math.floor(((sprite.position.z + 50) / 100) * SIZE);
      
      // Boundary Wrap for the lookup
      gx = (gx % SIZE + SIZE) % SIZE;
      gz = (gz % SIZE + SIZE) % SIZE;
      
      const idx = (gz * SIZE + gx) * 2;
      
      // Get Velocities from the physics engine
      const u = sim.uSp ? sim.uSp[idx] : 0;
      const v = sim.vSp ? sim.vSp[idx] : 0;
      const currentSpeed = Math.sqrt(u * u + v * v);

      // --- 3. THE ACTUAL MOVEMENT ---
      // We apply the current directly to X and Z
      sprite.position.x += u * sim.dt * flowIntensity;
      sprite.position.z += v * sim.dt * flowIntensity;

      // --- 4. LIFE & WRAPPING ---
      uData.age++;
      
      // If they go off the "map", wrap them around like the fluid does
      if (sprite.position.x > 50) sprite.position.x = -50;
      if (sprite.position.x < -50) sprite.position.x = 50;
      if (sprite.position.z > 50) sprite.position.z = -50;
      if (sprite.position.z < -50) sprite.position.z = 50;

      if (uData.age > uData.maxAge) {
        this.scene.remove(sprite);
        this.shrimpArray.splice(i, 1);
        continue;
      }

      // --- 5. SURFACE ADHESION ---
      // This makes them "stick" to the 3D waves
      const meshIdx = (gz * SIZE + gx) * 3;
      // Index 2 is the Z-displacement in PlaneGeometry that we use as Height
      const height = oceanPositions[meshIdx + 2] || 0;
      sprite.position.y = height + 1.5;

      const jitter = (Math.random() + 2.5) * 0.1;
      sprite.position.x += (u * sim.dt * flowIntensity) + jitter;
      sprite.position.z += (v * sim.dt * flowIntensity) + jitter;

      // Calculate how fast they are 'pogoing'
      const verticalVelocity = sprite.position.y - (uData.lastY || 0);
      uData.lastY = sprite.position.y;

      // Spin the sprite based on how fast it's being launched or dropped
      sprite.material.rotation += verticalVelocity * 0.5;
      
      // Fade out based on age
      sprite.material.opacity = Math.min(0.9, 1.0 - (uData.age / uData.maxAge));
    }
  }

  toggle(visible) {
    this.shrimpArray.forEach(s => s.visible = visible);
  }
}