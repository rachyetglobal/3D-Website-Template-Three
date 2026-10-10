/**
 * Optional Three.js viewer for a REAL architectural model (GLB/GLTF).
 * Three.js is only downloaded when PROPERTY.model.url is set — otherwise the
 * page shows a setup notice. This is deliberately separate from the film tour.
 */
import { PROPERTY } from './config.js';

const $ = (s) => document.querySelector(s);
document.querySelectorAll('[data-bind="name"]').forEach((el) => { el.textContent = PROPERTY.name; });
$('[data-mark]').textContent = PROPERTY.shortName.charAt(0);
document.title = `3D Model — ${PROPERTY.name}`;

const status = $('[data-status]');
const showNotice = () => { $('[data-notice]').hidden = false; };

async function start(url) {
  status.textContent = 'Loading viewer…';
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  const host = $('[data-viewer]');
  host.hidden = false;
  $('[data-panel]').hidden = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f0e0c);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.05, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.495;

  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync(url, (e) => {
    if (e.total) status.textContent = `Loading model — ${Math.round((e.loaded / e.total) * 100)}%`;
  });
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(model);

  // Frame the model.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.copy(center).add(new THREE.Vector3(dist * 0.7, dist * 0.45, dist * 0.7));
  camera.near = radius / 100;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = radius * 0.2;
  controls.maxDistance = dist * 3;
  controls.update();
  status.textContent = '';

  const onResize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  window.addEventListener('resize', onResize);

  // Render only while visible.
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : () => { controls.update(); renderer.render(scene, camera); });
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    draco.dispose();
    pmrem.dispose();
    renderer.dispose();
  }, { once: true });
}

const url = PROPERTY.model && PROPERTY.model.url;
if (!url) {
  showNotice();
} else {
  start(url).catch((err) => {
    console.error('[3d] Could not load model:', err);
    $('[data-viewer]').hidden = true;
    $('[data-panel]').hidden = true;
    status.textContent = '';
    showNotice();
    $('[data-notice] strong').textContent = `The model at "${url}" could not be loaded.`;
  });
}
