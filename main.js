import * as THREE from 'three';
import { GUI } from 'lil-gui';
import { EddyPhysics } from './physics.js';
import { ShrimpSwarm } from './shrimp.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- CONFIGURATION ---
const SIZE = 128; // Must be power of 2
const params = {
  viscosity: 0.001,
  dt: 0.05,           
  colorContrast: 50.0, 
  vortexDepth: 0.1,    // Added separate parameter for vertical scale
  reset: () => sim.initVorticity(),
  showShrimp: true
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x00050a); // Deepest ocean black-blue

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- CAMERA & CONTROLS ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 60, 80);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1; // Prevent going under the floor
controls.minDistance = 20;
controls.maxDistance = 250;

// --- PHYSICS INITIALIZATION ---
const sim = new EddyPhysics(SIZE, params.viscosity, params.dt);
// Note: sim is initialized with params, but needs onChange to update live

// --- ACTORS ---
const swarm = new ShrimpSwarm(scene, 300);

// --- OCEAN MESH SETUP ---
const geometry = new THREE.PlaneGeometry(100, 100, SIZE - 1, SIZE - 1);
geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SIZE * SIZE * 3), 3));

const material = new THREE.MeshPhongMaterial({
  color: 0xffffff,       // Base white to allow vertex colors to shine
  specular: 0x112244,
  shininess: 80,
  flatShading: true,
  side: THREE.DoubleSide,
  vertexColors: true     // Required for the dynamic color mapping
});

const mesh = new THREE.Mesh(geometry, material);
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);

// --- LIGHTING ---
const light = new THREE.DirectionalLight(0xffffff, 2.0);
light.position.set(10, 50, 10);
scene.add(light);
scene.add(new THREE.AmbientLight(0x102040));

// --- GUI ---
const gui = new GUI();
// Use .onChange to pipe values back into the physics engine
gui.add(params, 'viscosity', 0, 0.005).name('Viscosity').onChange(val => {
  sim.viscosity = val;
});
gui.add(params, 'dt', 0.001, 0.2).name('Time Step').onChange(val => {
  sim.dt = val;
});
gui.add(params, 'colorContrast', 1.0, 100.0).name('Contrast');
gui.add(params, 'vortexDepth', 0.01, 0.5).name('Vortex Depth');
gui.add(params, 'reset').name('Re-seed Ocean');
gui.add(params, 'showShrimp').name('Cursed Shrimp').onChange(val => swarm.toggle(val));

// --- ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // 1. Update Camera
  controls.update();

  // 2. Physics Step
  sim.step();

  const count = geometry.attributes.position.count;
  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;

  for (let i = 0; i < count; i++) {
    const val = sim.vorticity[i * 2];
    const absVal = Math.abs(val);

    // --- 3D DISPLACEMENT ---
    // Now using the vortexDepth param for easy sedation/amplification
    positions[i * 3 + 2] = val * (params.colorContrast * params.vortexDepth);

    // --- DYNAMIC COLORING ---
    const r = i * 3;
    colors[r]     = 0.02 + absVal * 0.15; // R
    colors[r + 1] = 0.1 + absVal * 0.5;   // G
    colors[r + 2] = 0.4 + absVal * 0.3;   // B
  }

  // Necessary updates for Three.js
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();

  // 3. Move the Shrimp
  swarm.update(sim, geometry.attributes.position.array);

  renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Launch!
animate();