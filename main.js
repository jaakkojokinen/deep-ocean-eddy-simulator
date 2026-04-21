import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { EddyPhysics } from './physics.js';
import { ShrimpSwarm } from './shrimp.js';

// --- CONFIGURATION ---
const SIZE = 128; // Must be power of 2
const params = {
  viscosity: 0.001,
  dt: 0.05,           
  colorContrast: 50.0, 
  reset: () => sim.initVorticity(),
  showShrimp: true
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();

const swarm = new ShrimpSwarm(scene, 1000);

// Orthographic camera is best for 2D fluid "maps"
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 100);
camera.lookAt(0, 0, 0);
window.camera = camera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- PHYSICS INITIALIZATION ---
const sim = new EddyPhysics(SIZE, params.viscosity, params.dt);
window.sim = sim; 
window.params = params;
sim.dt = params.dt;
sim.viscosity = params.viscosity;
sim.windStrength = params.windStrength || 0.005; // Connect to GUI

// --- SHADER SETUP ---
const material = new THREE.MeshPhongMaterial({
  color: 0x0044ff,       // Base blue
  emissive: 0x001133,    // Dark blue glow so shadows aren't pitch black
  specular: 0x112244,
  shininess: 50,
  flatShading: true,
  side: THREE.DoubleSide
});

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(10, 50, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));
window.light = light;

const geometry = new THREE.PlaneGeometry(100, 100, SIZE - 1, SIZE - 1);
geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SIZE * SIZE * 3), 3));
material.vertexColors = true; // Ensure your material has this enabled
window.geometry = geometry;

const mesh = new THREE.Mesh(geometry, material);
mesh.rotation.x = -Math.PI / 2;
window.mesh = mesh;
scene.add(mesh);

// --- DATA TEXTURE SETUP ---
// This array holds the raw physics values to be sent to the GPU
const dataArray = new Float32Array(SIZE * SIZE);
const texture = new THREE.DataTexture(
  dataArray, 
  SIZE, 
  SIZE, 
  THREE.RedFormat, 
  THREE.FloatType
);
texture.unpackAlignment = 1;

// Critical settings for floating point data textures
texture.minFilter = THREE.NearestFilter;
texture.magFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.flipY = false;
texture.internalFormat = 'R32F'; 
texture.needsUpdate = true;

// --- GUI ---
const gui = new GUI();
gui.add(params, 'viscosity', 0, 0.005).name('Viscosity');
gui.add(params, 'dt', 0.001, 0.2).name('Time Step');
gui.add(params, 'colorContrast', 1.0, 100.0).name('Contrast');
gui.add(params, 'colorContrast', 0.1, 10.0).name('Vortex Depth');
gui.add(params, 'reset').name('Re-seed Ocean');
gui.add(params, 'showShrimp').name('Cursed Shrimp').onChange(val => swarm.toggle(val));

// --- ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // 1. Physics Step
  sim.step();

  const count = geometry.attributes.position.count;
  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;

  for (let i = 0; i < count; i++) {
    // Safety: Ensure we map 1-to-1 with the physics grid
    const val = sim.vorticity[i * 2];
    const absVal = Math.abs(val);

    // --- 3D DISPLACEMENT ---
    // Reduced intensity (0.1 multiplier) to prevent "Skyscrapers"
    // We use the Z-axis (index * 3 + 2) because it's a PlaneGeometry
    positions[i * 3 + 2] = val * (params.colorContrast * 0.1);

    // --- DYNAMIC COLORING ---
    // This makes the 'spin' visible even in deep shadow
    const r = i * 3;
    
    // Base: Deep Navy Blue
    // Highlight: Neon Cyan / Electric Blue based on spin speed
    colors[r]     = 0.05 + absVal * 0.1; // Slight purple in high spin
    colors[r + 1] = 0.2 + absVal * 0.6;  // Bright Green/Cyan component
    colors[r + 2] = 0.5 + absVal * 0.4;  // Solid Blue base
  }

  // Mandatory updates for Three.js to see the changes
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();

  // Move the shrimp!
  swarm.update(sim, geometry.attributes.position.array);

  renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Launch!
animate();

// const stream = renderer.domElement.captureStream(60); // 60 FPS
// const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
// const chunks = [];

// recorder.ondataavailable = e => chunks.push(e.data);
// recorder.onstop = () => {
//   const blob = new Blob(chunks, { type: 'video/webm' });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = 'eddies.webm';
//   a.click();
// };

// // Start recording for 5 seconds
// recorder.start();
// setTimeout(() => recorder.stop(), 5000);