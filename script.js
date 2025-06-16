console.clear();
document.getElementById("hud").style.display = "none";
document.getElementById("controls").style.display = "none";
document.getElementById("compassUI").style.display = "none";

let rain; // Declare the variable globally
let weatherState = "clear"; // or "rain", "storm", etc.
let weatherTimer = null;
const weatherOptions = [
    "clear", "clear", "clear",
    "rain", 
    "storm"
];

let fogColorTarget = new THREE.Color();
let fogFadeSpeed = 0.02;
let fogNearTarget = 100;
let fogFarTarget = 2000;

let rainOpacityTarget = 0;

let lastLightningTime = 0;
const lightningCooldown = 1000; // 1s cooldown
const MAX_LIGHTNING_BOLTS = 3; // Restrict how many bolts exist at a time
const lightningBolts = []; // Store all active bolts

let lightningEnabled = false; // Default: Lightning is ON

const allTrees = [];

const lastKeyPress = { left: 0, right: 0 }; // ✅ Now it exists!
const keyPressCount = { left: 0, right: 0 };
const lastKeyPressTime = { left: Date.now(), right: Date.now() }; // ✅ Ensures it's tracking time correctly
const rollThreshold = 300; // ✅ Time limit for double press
const rollCooldown = 1000; // ✅ 1-second cooldown between rolls
const keysHeld = {}; // ✅ Tracks whether a key is actively being pressed
const throttleIncrement = 0.0006;
const deadZone = 0.90;
const stickSensitivity = 0.5;
const vibeCooldown = 500; // 2 seconds
let lastRollTime = 0; // ✅ Track last roll time
let lastVibe = 0;


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87ceeb, 1);
document.body.appendChild(renderer.domElement);

window.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("lowPowerToggle");
  toggleBtn.addEventListener("click", () => {
    lowPowerMode = !lowPowerMode;
    toggleBtn.textContent = `⚡ Low Power Mode: ${lowPowerMode ? "ON" : "OFF"}`;
    renderer.setPixelRatio(lowPowerMode ? 0.5 : window.devicePixelRatio);
  });
});

document.getElementById("toggleLightning").addEventListener("click", () => {
  lightningEnabled = !lightningEnabled;
  document.getElementById("toggleLightning").textContent = ("⚡ Lightning is now:", lightningEnabled ? "Toggle Lightning: ON" : "Toggle Lightning: OFF");
  if (lightningEnabled) {
    document.getElementById("lightningWarning").style.display = "block";
  } else {
    document.getElementById("lightningWarning").style.display = "none";
  }
});

let lowPowerMode = false;

const hudAltitude = document.getElementById("altitude");
const hudSpeed = document.getElementById("speed");
const hudxyz = document.getElementById("xyz")
let lastPosition = new THREE.Vector3();

let gameStarted = false;
let crashed = false;
let crashTimer = 0;
let velocityY = 0;

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemisphereLight);

let chunkSize = 500;
let chunkCount = 4; // 4x4 grid
const groundChunks = [];

if (!lowPowerMode) {
  chunkSize = 500;
  chunkCount = 4;
} else {
  chunkSize = 50;
  chunkCount = 1;
}


for (let i = -1; i <= 1; i++) {
  for (let j = -1; j <= 1; j++) {
    const chunk = new THREE.Mesh(
      new THREE.PlaneGeometry(chunkSize, chunkSize),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    chunk.rotation.x = -Math.PI / 2;
    chunk.position.set(i * chunkSize, 0, j * chunkSize);
    scene.add(chunk);
    groundChunks.push(chunk);
  }
}

const planeBox = new THREE.Box3();

const cloudSpawnRadius = 1000;
const maxClouds = 200;
const clouds = [];

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);

function create3DCloud(x, y, z) {
    const cloud = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const count = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < count; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(Math.random() + 1, 16, 16), mat);
      puff.position.set(Math.random() * 3 - 1.5, Math.random() * 1 - 0.5, Math.random() * 2 - 1);
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    const scaleFactor = Math.random() * 0.5 + 1.5; // between 1.5 and 2.0
    cloud.scale.set(scaleFactor, scaleFactor, scaleFactor);
    return cloud;
}

function generateCloudsAround(position) {
    while (clouds.length < maxClouds) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * cloudSpawnRadius;
      const x = position.x + Math.cos(angle) * distance;
      const z = position.z + Math.sin(angle) * distance;
      const y = Math.random() * 300 + 100;
  
      const cloud = create3DCloud(x, y, z);
      clouds.push(cloud);
      cloudGroup.add(cloud);
    }
}

for (let i = 0; i < 150; i++) {
  const x = Math.random() * 2000 - 1000;
  const y = Math.random() * 400 - 100;
  const z = Math.random() * 2000 - 1000;
  cloudGroup.add(create3DCloud(x, y, z));
}

function getRandomCloudPosition() {
  if (cloudGroup.children.length === 0) return { x: 0, y: 200, z: -500 }; // Fallback

  const cloud = cloudGroup.children[Math.floor(Math.random() * cloudGroup.children.length)];
  return cloud.position; // Use real cloud positions
}


function createTree(x, y, z) {
    const tree = new THREE.Group();
  
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1),
      new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 0.5;
    tree.add(trunk);
  
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    leaves.position.y = 1.4;
    tree.add(leaves);
  
    tree.position.set(x, y, z);
    const scale = Math.random() * 0.5 + 1.3; // between 1.3 and 1.8
    tree.scale.set(scale, scale, scale);
    tree.updateMatrixWorld(true);

    trunk.geometry.computeBoundingBox();
    const boundingBox = trunk.geometry.boundingBox.clone();
    boundingBox.applyMatrix4(trunk.matrixWorld);

    tree.userData.boundingBox = boundingBox;

    return tree;
}

function createFlower(x, y, z) {
    const flower = new THREE.Group();
  
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    stem.position.y = 0.2;
    flower.add(stem);
  
    const blossom = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xff69b4 })
    );
    blossom.position.y = 0.45;
    flower.add(blossom);
  
    flower.position.set(x, y, z);
    const flowerScale = Math.random() * 0.3 + 1.5;
    flower.scale.set(flowerScale, flowerScale, flowerScale);
    return flower;
}
  
groundChunks.forEach(chunk => {
    chunk.userData.trees = [];
    chunk.userData.flowers = [];
    
    for (let i = 0; i < 10; i++) {
      const tx = chunk.position.x + Math.random() * chunkSize - chunkSize / 16;
      const tz = chunk.position.z + Math.random() * chunkSize - chunkSize / 16;
    
      const tree = createTree(tx, 0, tz);
      tree.scale.setScalar(Math.random() * 1.5 + 3.0);
      scene.add(tree);

      chunk.userData.trees.push(tree);
    
      if (Math.random() < 0.6) {
        const fx = chunk.position.x + Math.random() * chunkSize - chunkSize / 16;
        const fz = chunk.position.z + Math.random() * chunkSize - chunkSize / 16;
    
        const flower = createFlower(fx, 0, fz);
        flower.scale.setScalar(Math.random() * 0.5 + 2.5);
        scene.add(flower);
        chunk.userData.flowers.push(flower);
      }
    }    
});  

const yawGroup = new THREE.Object3D();
const pitchGroup = new THREE.Object3D();
yawGroup.add(pitchGroup);
scene.add(yawGroup);
yawGroup.position.y = 30;

generateCloudsAround(yawGroup.position);  

const plane = new THREE.Group();

plane.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 3.5), new THREE.MeshLambertMaterial({ color: 0xff5555 })));

const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0x66ccff, transparent: true, opacity: 0.75 }));
cockpit.position.set(0, 0.25, 1.2);
plane.add(cockpit);

const wingMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.6), wingMat);
leftWing.position.set(-1, 0, 0.2);
plane.add(leftWing);
const rightWing = leftWing.clone();
rightWing.position.x = 1;
plane.add(rightWing);

const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x999999 }));
tailFin.position.set(0, 0.4, -1.5);
plane.add(tailFin);
const leftTail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.2), new THREE.MeshLambertMaterial({ color: 0x999999 }));
leftTail.position.set(-0.5, 0, -1.5);
plane.add(leftTail);
const rightTail = leftTail.clone();
rightTail.position.x = 0.5;
plane.add(rightTail);

let propeller = new THREE.Group();
const bladeGeom = new THREE.BoxGeometry(0.1, 2, 0.05);
const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
for (let i = 0; i < 4; i++) {
const blade = new THREE.Mesh(bladeGeom, bladeMat);
blade.rotation.z = i * (Math.PI / 2);
propeller.add(blade);
}
propeller.position.set(0, 0, 1.95);
plane.add(propeller);

const pilot = new THREE.Group();
const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xffcc99 }));
head.position.y = 0.15;
pilot.add(head);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.2), new THREE.MeshLambertMaterial({ color: 0x003366 }));
torso.position.y = -0.25;
pilot.add(torso);
pilot.position.set(0, 0.15, 1.1);
plane.add(pilot);

plane.rotation.y = Math.PI;
pitchGroup.add(plane);

class AIPlane {
    constructor() {
        this.mesh = new THREE.Group();

        // Body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.8, 6), 
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        this.mesh.add(body);

        // Wings
        const wingL = new THREE.Mesh(
            new THREE.BoxGeometry(4, 0.2, 1), 
            new THREE.MeshStandardMaterial({ color: 0x666666 })
        );
        wingL.position.set(-2, 0, 0);
        this.mesh.add(wingL);

        const wingR = wingL.clone();
        wingR.position.x *= -1;
        this.mesh.add(wingR);

        // Tail
        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.4, 1), 
            new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        tail.position.set(0, 0.4, -2.8);
        this.mesh.add(tail);

        // Random start position
        this.mesh.position.set(
            Math.random() * 100 - 50, 
            Math.random() * 30 + 10, 
            Math.random() * 100 - 50
        );

        // Random movement direction
        this.velocity = new THREE.Vector3(
            Math.random() * 0.2 - 0.1, // Slight lateral drift
            0, 
            Math.random() * 0.2 + 0.1 // Forward movement
        );

        scene.add(this.mesh);
    }

    update() {
        this.mesh.position.add(this.velocity); // ✅ Moves forward properly
        this.updateRotation(); // ✅ Rotate to face movement direction
    }

    updateRotation() {
        const direction = this.velocity.clone().normalize();
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = targetRotation; // ✅ Face the movement direction
    }
}


let aiPlanes = [];

function getRandomChunkPosition() {
    const randomChunk = groundChunks[Math.floor(Math.random() * groundChunks.length)]; // ✅ Pick a chunk
    const chunkX = randomChunk.position.x + Math.random() * chunkSize - chunkSize / 2;
    const chunkZ = randomChunk.position.z + Math.random() * chunkSize - chunkSize / 2;

    return new THREE.Vector3(chunkX, Math.random() * 30 + 10, chunkZ);
}

let MAX_AI_PLANES = 50;

function spawnAIPlane() {
    if (aiPlanes.length >= MAX_AI_PLANES) return;
    const newAIPlane = new AIPlane();
    newAIPlane.mesh.position.copy(getRandomChunkPosition());
    aiPlanes.push(newAIPlane);
}

function updateAIPlanes() {
    aiPlanes.forEach(plane => plane.update());
}

function cleanupAIPlanes(planePos2D) {
    aiPlanes = aiPlanes.filter(plane => {
        const aiPlanePos2D = new THREE.Vector2(plane.mesh.position.x, plane.mesh.position.z); // ✅ Convert AI plane position to 2D
        const distance = aiPlanePos2D.distanceTo(planePos2D);

        if (distance > 800) { // ✅ Remove AI planes beyond range
            scene.remove(plane.mesh);
            return false; // Removes from array
        }
        return true; // Keeps the plane
    });
}



const keys = {};
let gameOver = false;
let speed = 0.2;
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

const sparks = [];
function spawnSparks(pos) {
  for (let i = 0; i < 30; i++) {
  const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 1 })
  );
  spark.position.copy(pos);
  spark.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5
  );
  sparks.push(spark);
  scene.add(spark);
  }
}
 
// Cloudy weather
scene.fog = new THREE.Fog(0xaaaaaa, 100, 800);
renderer.setClearColor(0xaaaaaa);

hemisphereLight.intensity = 0.4;

function initRain() {
    const rainGeometry = new THREE.BufferGeometry();
    const rainCount = 1000;
    const rainPositions = new Float32Array(rainCount * 3);
  
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = Math.random() * 1000 - 500;
      rainPositions[i * 3 + 1] = Math.random() * 500;
      rainPositions[i * 3 + 2] = Math.random() * 1000 - 500;
    }
  
    rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  
    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaee,
      size: 1,
      transparent: true,
      opacity: 0.6,
    });
  
    rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);
}

function showHudMessage(text) {
    const hudMessage = document.getElementById("hudMessage");
    hudMessage.textContent = "Weather status: "+text;
    hudMessage.style.display = "block";
}

const lightning = new THREE.PointLight(0xffffff, 5, 500);
lightning.position.set(0, 300, -500); // Place it in the storm clouds
scene.add(lightning);

// Initially keep it off
lightning.visible = false;

function createLightningBolt(startX, startY, startZ) {
  const boltMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const boltGeometry = new THREE.BufferGeometry();

  // Generate random lightning shape
  const positions = [];
  let currentX = startX, currentY = startY, currentZ = startZ;

  for (let i = 0; i < 5; i++) {
    positions.push(currentX, currentY, currentZ);
    currentX += (Math.random() - 0.5) * 10; // Slight zig-zag
    currentY -= Math.random() * 99; // Moves downward
    currentZ += (Math.random() - 0.5) * 5;
  }

  boltGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const bolt = new THREE.Line(boltGeometry, boltMaterial);
  scene.add(bolt);

  return bolt;
}

function groundStrikeEffect(x, z) {
  const flash = new THREE.PointLight(0xffffff, 3, 200);
  flash.position.set(x, 10, z); // Position at ground level
  scene.add(flash);

  setTimeout(() => scene.remove(flash), 300);
}

function triggerLightning() {
  if (!lightningEnabled) return; // 🚫 Stop lightning if disabled
  if (weatherState === "storm") {
    const now = Date.now();
    if (now - lastLightningTime < lightningCooldown) return; // If not cooled down, do nothing
    lastLightningTime = now; // Update last strike time
    if (lightningBolts.length >= MAX_LIGHTNING_BOLTS) return; // Prevent overloading
    

    const cloudPos = getRandomCloudPosition(); // Pick a real cloud
    const bolt = createLightningBolt(cloudPos.x, cloudPos.y, cloudPos.z);

    lightningBolts.push(bolt); // Store the new bolt

    lightning.position.set(cloudPos.x, cloudPos.y, cloudPos.z);
    lightning.visible = true;

    if (bolt.geometry.attributes.position.array[bolt.geometry.attributes.position.count * 3 - 2] < 10) {
      groundStrikeEffect(bolt.position.x, bolt.position.z);
    }    

    const gp = navigator.getGamepads()[0];
    if (gp && gp.vibrationActuator) {
        gp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: 200,         // very short burst (ms)
            strongMagnitude: 1.0,  // max intensity
            weakMagnitude: 0.6     // balance both motors
        });
    } else {
        console.log("❌ No vibration support on this platform.");
    }

    setTimeout(() => {
      lightning.visible = false;
      if (scene.children.includes(bolt)) {
        scene.remove(bolt); // ✅ Ensure it's still in the scene before removing
      }
      lightningBolts = lightningBolts.filter(b => b !== bolt); // ✅ Remove from tracking list
    }, 200); // Flash lasts 200ms
  }
}

function updateWeatherEffects() {
  setInterval(() => {
    if (weatherState === "storm") {
      triggerLightning();
    }
  }, 2000);
  requestAnimationFrame(updateWeatherEffects);
}

function randomizeWeather() {
    // Pick a new, different state
    let next;
    do {
      next = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
    } while (next === weatherState);
  
    weatherState = next;
  
    if (weatherState === "rain" || weatherState === "storm") {
      rain.visible = true;
  
      // Reset raindrop heights
      const pos = rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.array[i * 3 + 1] < 10) {
          pos.array[i * 3 + 1] = Math.random() * 500 + 100;
        }
      }
      pos.needsUpdate = true;
  
      // 🌩️ Stormy fog tweaks
      if (weatherState === "storm") {
        showHudMessage("STORM AHEAD!");
        fogColorTarget.set(0x444455);
        fogNearTarget = 50;
        fogFarTarget = 300;
        rain.visible = true;
        rainOpacityTarget = 0.6;
        camera.position.y = Math.max(camera.position.y, 20);
        rain.material.color = 0x003366;
      
      } else if (weatherState === "rain") {
        showHudMessage("LIGHT RAIN AHEAD!");
        fogColorTarget.set(0x888888);
        fogNearTarget = 80;
        fogFarTarget = 600;
        rain.visible = true;
        rainOpacityTarget = 0.3;
        camera.position.y = Math.max(camera.position.y, 20);
        rain.material.color = 0xaaaaee;
      
      } else {
        fogColorTarget.set(0xcce0ff);
        fogNearTarget = 100;
        fogFarTarget = 800;
        renderer.setClearColor(0xcce0ff);
        rainOpacityTarget = 0;
      }      
      rain.material.opacity = weatherState === "storm" ? 0.6 : 0.3;
  
    } else {
      showHudMessage("CLEAR SKYS AHEAD!");
      rain.visible = false;
      scene.fog.color.set(0xcce0ff);
      scene.fog.near = 100;
      scene.fog.far = 800;
      renderer.setClearColor(0xcce0ff);
      rain.material.opacity = 0;
    }
  
    clearTimeout(weatherTimer);
    weatherTimer = setTimeout(randomizeWeather, Math.random() * 30000 + 15000);
}

// THE GOD DAMN BIRDSSS
class Bird {
  constructor(x, y, z) {
    this.mesh = new THREE.Group();

    //Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    this.mesh.add(body);

    // Wings
    this.wingL = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 0.2), 
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    this.wingL.position.set(-0.4, 0, 0);
    this.mesh.add(this.wingL);

    this.wingR = this.wingL.clone();
    this.wingR.position.x *= -1;
    this.mesh.add(this.wingR);

    // Position bird
    this.mesh.position.set(x, y, z);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3(Math.random(), Math.random(), Math.random());
    this.flapAngle = 0; // Tracks wing movement
  }

  update(flock, plane) {
    let alignment = new THREE.Vector3();
    let cohesion = new THREE.Vector3();
    let separation = new THREE.Vector3();
    let escapeForce = new THREE.Vector3();
    let neighborCount = 0;

    flock.forEach(bird => {
      if (bird === this) return;

      let distance = this.mesh.position.distanceTo(bird.mesh.position);
      if (distance < 20) { // Only affects close birds
        alignment.add(bird.velocity);
        cohesion.add(bird.mesh.position);
        separation.sub(bird.mesh.position.clone().sub(this.mesh.position).normalize());
        neighborCount++;
      }
    });

    if (neighborCount > 0) {
      alignment.divideScalar(neighborCount).normalize().multiplyScalar(0.05);
      cohesion.divideScalar(neighborCount).sub(this.mesh.position).normalize().multiplyScalar(0.01);
      separation.multiplyScalar(0.2);
    }

    // **Update velocity**
    this.velocity.add(alignment).add(cohesion).add(separation).add(escapeForce);
    this.velocity.clampLength(0.1, 0.3); // Limits speed to prevent stuck birds

    // **Move bird**
    this.mesh.position.add(this.velocity);
    this.mesh.updateMatrixWorld(true);


    // 🦅 **Flap animation**
    this.flapAngle += 0.2; // Adjust speed of flapping
    const flapAmount = Math.sin(this.flapAngle) * 0.3; // Wing movement range
    this.wingL.rotation.z = flapAmount;
    this.wingR.rotation.z = -flapAmount;
  }
}

// Generate flock
const flock = [];
for (let i = 0; i < 10; i++) {
  flock.push(new Bird(
    yawGroup.position.x + Math.random() * 50 - 25,
    Math.random() * 20 + 10,
    yawGroup.position.z + Math.random() * 50 - 25
  ));
}

// Animate birds
function animateBirds() {
  flock.forEach(bird => bird.update(flock, yawGroup));
}

function createFeatherExplosion(position) {
    const feathers = [];

    for (let i = 0; i < 20; i++) { // Adjust number for bigger poofs
        const feather = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.1), // Feather shape
            new THREE.MeshLambertMaterial({ 
                color: 0xffffff, // White or brown feathers
                side: THREE.DoubleSide,
                transparent: true
            })
        );

        feather.position.copy(position);
        feather.velocity = new THREE.Vector3(
            Math.random() * 2 - 1, 
            Math.random() * 1.5, 
            Math.random() * 2 - 1 
        ); // Random outward movement

        scene.add(feather);
        feathers.push(feather);
    }

    return feathers;
}

function updateFeathers(feathers) {
    feathers.forEach((feather, i) => {
        feather.velocity.y -= 0.02; // Gravity effect
        feather.position.add(feather.velocity);
        feather.rotation.z += Math.random() * 0.1;
        feather.material.opacity -= 0.02; // Fade out over time

        if (feather.material.opacity <= 0) {
            scene.remove(feather);
            feathers.splice(i, 1);
        }
    });
}

//BARREL ROLL BABYYYY
let rolling = false;

function barrelRoll(direction) {
    rolling = true;
    const now = Date.now();
    if (now - lastRollTime < rollCooldown) return; // ✅ Prevent spam rolls

    lastRollTime = now; // ✅ Update last roll time

    const rollAmount = Math.PI * 2; // ✅ Full 360° rotation

    new TWEEN.Tween(pitchGroup.rotation)
        .to({ z: direction === "left" ? pitchGroup.rotation.z + rollAmount : pitchGroup.rotation.z - rollAmount }, 600) // ✅ Smooth roll in 600ms
        .easing(TWEEN.Easing.Cubic.InOut)
        .onComplete(() => {
          pitchGroup.rotation.z %= Math.PI * 2;
          rolling = false;
        })
        .start();
}


//wingtip smoke??
const smokeParticles = new THREE.Group(); // ✅ Holds multiple smoke elements
scene.add(smokeParticles);

function createSmoke(position) {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8); // ✅ Small sphere as a particle
    const material = new THREE.MeshBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.8,
    });

    const smoke = new THREE.Mesh(geometry, material);
    smoke.position.copy(position);
    smokeParticles.add(smoke);

    new TWEEN.Tween(smoke.material)
        .to({ opacity: 0 }, 5000) // ✅ Fade out naturally
        .start();
        
}

function updateSmoke() {
    if (!rolling) return;
    const wingtipLeft = new THREE.Vector3(-1.6, 0, 0);
    const wingtipRight = new THREE.Vector3(1.6, 0, 0);

    plane.localToWorld(wingtipLeft);
    plane.localToWorld(wingtipRight);

    createSmoke(wingtipLeft); // ✅ Now actually generates smoke at left wingtip
    createSmoke(wingtipRight); // ✅ And at right wingtip

    // ✅ Fade-out effect instead of deletion
    smokeParticles.children.forEach((smoke, index) => {
        const wingtipLeft = new THREE.Vector3(-1.6, 0, 0);
        const wingtipRight = new THREE.Vector3(1.6, 0, 0);

        plane.localToWorld(wingtipLeft);
        plane.localToWorld(wingtipRight);

        smoke.position.lerp(index % 2 === 0 ? wingtipLeft : wingtipRight, 0.001);
    });
}

function triggerRumble(strength = 0.5, duration = 100) {
    const gp = navigator.getGamepads()[0];
    if (gp && gp.vibrationActuator) {
        gp.vibrationActuator.playEffect("dual-rumble", {
            duration: duration,
            strongMagnitude: strength,
            weakMagnitude: strength * 0.5,
            startDelay: 0
        });
    } else {
        console.log("❌ No vibration support on this platform.");
    }
}

function updateCompassUI() {
    const dir = new THREE.Vector3();
    plane.getWorldDirection(dir); // get world forward vector

    // Convert to compass heading in degrees
    const heading = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    const normalized = (heading + 360) % 360;

    // Determine compass label
    const cardinalLabels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const labelIndex = Math.round(normalized / 45) % 8;
    const cardinal = cardinalLabels[labelIndex];

    // Apply proper formatting—trim leading zeroes unless above 100
    const formattedHeading = normalized >= 100 ? normalized.toFixed(0) : normalized.toFixed(0).replace(/^0+/, '');

    // Update UI
    const compassDegrees = document.getElementById("compassDegrees");
    compassDegrees.textContent = `${formattedHeading}° ${cardinal}`;
}

function triggerControllerAlert() {
  const pad = navigator.getGamepads()[0];
  if (pad?.vibrationActuator) {
    pad.vibrationActuator.playEffect("dual-rumble", {
      duration: 300,
      strongMagnitude: 0.8,
      weakMagnitude: 0.2
    });
  } else {
    console.log("❌ No vibration support on this platform.");
  }
}

let isPaused = false;

function togglePause() {
  isPaused = !isPaused;
  document.getElementById("pauseMenu").style.display = isPaused ? "block" : "none";
}

function resumeGame() {
  isPaused = false;
  document.getElementById("pauseMenu").style.display = "none";
}


function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        togglePause();
      }
    });

    if (!isPaused) {
      // Smooth fog color blending
      scene.fog.color.lerp(fogColorTarget, fogFadeSpeed);

      // Smooth fog distance transitions
      scene.fog.near += (fogNearTarget - scene.fog.near) * fogFadeSpeed;
      scene.fog.far += (fogFarTarget - scene.fog.far) * fogFadeSpeed;
    
      const pitchSpeed = 0.01;
      const yawSpeed = 0.005;
    
      if (keys["w"] || keys["W"]) speed += 0.002;
      if (keys["s"] || keys["S"]) speed -= 0.002;
      speed = Math.max(0, Math.min(speed, 0.5926));
    
      const controlsEnabled = speed > 0.1;
      if (controlsEnabled && !gameOver) {
        if (keys["ArrowUp"]) pitchGroup.rotation.x -= pitchSpeed;
        if (keys["ArrowDown"]) pitchGroup.rotation.x += pitchSpeed;
        if (keys["ArrowLeft"]) yawGroup.rotation.y += yawSpeed;
        if (keys["ArrowRight"]) yawGroup.rotation.y -= yawSpeed;
        window.addEventListener("gamepadconnected", (event) => {
          console.log("Gamepad connected:", event.gamepad.id);

            const gp = event.gamepad;
            // Welcome buzz
            if (gp.vibrationActuator) {
              gp.vibrationActuator.playEffect("dual-rumble", {
                duration: 300,
                strongMagnitude: 1.0,
                weakMagnitude: 0.5,
              });
            } else {
              console.log("❌ No vibration support.");
            }

          requestAnimationFrame(function gamepadLoop(timestamp) {
            const gp = navigator.getGamepads()[0];
            if (gp) {
              const lx = gp.axes[0];
              const ly = gp.axes[1];

              // Pitch
              if (Math.abs(ly) > deadZone) {
                pitchGroup.rotation.x += ly * pitchSpeed * stickSensitivity;
              }

              // Yaw
              if (Math.abs(lx) > deadZone) {
                yawGroup.rotation.y -= lx * yawSpeed * stickSensitivity;
              }

              // --- Camera roll based on directional input (left/right) ---
              const targetRoll = lx < -deadZone ? 0.4 : lx > deadZone ? -0.4 : 0;
              pitchGroup.rotation.z += (targetRoll - pitchGroup.rotation.z) * 0.1;

              // Barrel roll (with cooldown)
              if (timestamp - lastRollTime > rollCooldown) {
                if (gp.buttons[4].pressed) {
                  barrelRoll("left");
                  lastRollTime = timestamp;
                } else if (gp.buttons[5].pressed) {
                  barrelRoll("right");
                  lastRollTime = timestamp;
                }
              }

              // Throttle
              const rt = gp.buttons[7].value;
              const lt = gp.buttons[6].value;

              if (rt > 0.1) {
                speed += rt * throttleIncrement;
                triggerRumble(rt * speed * speed);
              };
              if (lt > 0.1) {
                speed -= lt * throttleIncrement; 
                triggerRumble(lt * speed * speed);
              };

              if (gp.buttons[9].pressed && !isPaused) {
                togglePause(); // Your pause logic
              }
              if (gp.buttons[0].pressed && isPaused) {
                resumeGame();
              }
              if (gp.buttons[1].pressed && isPaused) {
                window.location.reload();
              }
            }
            requestAnimationFrame(gamepadLoop);
          });
        });
        document.addEventListener("keydown", (event) => {
            if (keysHeld[event.code]) return; // ✅ Ignore repeat triggers while holding
            keysHeld[event.code] = true; // ✅ Marks key as pressed

            const now = Date.now();
            
            if (event.code === "ArrowLeft") {
                if (now - lastKeyPressTime.left < rollThreshold) {
                    keyPressCount.left++;
                } else {
                    keyPressCount.left = 1; // ✅ Reset count if too much time passed
                }

                lastKeyPressTime.left = now; // ✅ Store actual timestamp
                if (keyPressCount.left === 2) {
                    barrelRoll("left");
                    keyPressCount.left = 0; // ✅ Reset after rolling
                }
            }

            if (event.code === "ArrowRight") {
                if (now - lastKeyPressTime.right < rollThreshold) {
                    keyPressCount.right++;
                } else {
                    keyPressCount.right = 1; // ✅ Reset count if too much time passed
                }

                lastKeyPressTime.right = now;
                if (keyPressCount.right === 2) {
                    barrelRoll("right");
                    keyPressCount.right = 0;
                }
            }
        });

        // ✅ Reset key state when released
        document.addEventListener("keyup", (event) => {
            keysHeld[event.code] = false;
        });
        
      };

      if (controlsEnabled && !gameOver && !rolling) {
          const targetRoll = keys["ArrowLeft"] ? 0.4 : keys["ArrowRight"] ? -0.4 : 0;
          pitchGroup.rotation.z += (targetRoll - pitchGroup.rotation.z) * 0.1;
      }
    
      const forward = new THREE.Vector3(0, 0, -1);
      const worldQuat = new THREE.Quaternion();
      pitchGroup.getWorldQuaternion(worldQuat);
      forward.applyQuaternion(worldQuat);
      yawGroup.position.add(forward.multiplyScalar(speed));
    
      // Chunk grid tracking
      const px = Math.floor(yawGroup.position.x / chunkSize);
      const pz = Math.floor(yawGroup.position.z / chunkSize);
    
      let index = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const chunk = groundChunks[index++];
          const newGridX = px + i;
          const newGridZ = pz + j;

          if (chunk.userData.gridX !== newGridX || chunk.userData.gridZ !== newGridZ) {
            chunk.userData.gridX = newGridX;
            chunk.userData.gridZ = newGridZ;
            chunk.position.set(newGridX * chunkSize, 0, newGridZ * chunkSize);

            //rarely spawn birds (60% chance as of the comment below)
            if (!chunk.userData.birds) chunk.userData.birds = [];
            if (Math.random() < 0.6) { // 60% chance to spawn birds
              const bx = chunk.position.x + Math.random() * chunkSize - chunkSize / 8;
              const bz = chunk.position.z + Math.random() * chunkSize - chunkSize / 8;
              const by = Math.random() * 30 + 10; // Keep them flying above ground

              const bird = new Bird(bx, by, bz);
              scene.add(bird.mesh);
              chunk.userData.birds.push(bird);
            }

            //spawn ai planes in the sky
            if (Math.random() < 0.3) {
              // Spawn planes every few seconds
              setInterval(spawnAIPlane, 5000);
            }
    
            // Replant trees
            chunk.userData.trees?.forEach(tree => {
              tree.position.x = chunk.position.x + Math.random() * chunkSize - chunkSize / 16;
              tree.position.z = chunk.position.z + Math.random() * chunkSize - chunkSize / 16;

              tree.updateMatrixWorld(true); // Refresh transformations
              tree.userData.boundingBox.applyMatrix4(tree.matrixWorld); // Apply new world position
            });
    
            // Replant flowers
            chunk.userData.flowers?.forEach(flower => {
              flower.position.x = chunk.position.x + Math.random() * chunkSize - chunkSize / 16;
              flower.position.z = chunk.position.z + Math.random() * chunkSize - chunkSize / 16;
            });
          }

          // What happens per chunk ^^
        }
      }

      // Crash checks
      if (!crashed) {
        planeBox.setFromObject(plane);
        for (let i = 0; i < groundChunks.length; i++) {
          const chunkBox = new THREE.Box3().setFromObject(groundChunks[i]);
          if (planeBox.intersectsBox(chunkBox)) {
            crashed = true;
            speed = 0;
            pitchGroup.rotation.x = 0;
            pitchGroup.rotation.z = 0;
            crashTimer = performance.now();
            spawnSparks(yawGroup.position);
            const gp = navigator.getGamepads()[0];
            if (gp && gp.vibrationActuator) {
                gp.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: 300,         // very short burst (ms)
                    strongMagnitude: 1.0,  // max intensity
                    weakMagnitude: 0.5     // balance both motors
                });
            } else {
                console.log("❌ No vibration support on this platform.");
            }
            break;
          }
        }
      }

      if (!gameOver) {
        if (speed < 0.15) {
          yawGroup.position.y -= 0.2;
          pitchGroup.rotation.x -= 0.005;
        };
        if (speed >= 50) {
          pitchGroup.rotation.x *= 0.98;
        }
      }

      if (!crashed) {
        planeBox.setFromObject(plane);
        for (const chunk of groundChunks) {
          for (const tree of chunk.userData.trees) {
            const treeBox = new THREE.Box3().setFromObject(tree);
            if (planeBox.intersectsBox(treeBox)) {
              if (!crashed) {
                crashed = true;
                speed = 0;
                pitchGroup.rotation.x = 0;
                pitchGroup.rotation.z = 0;
                crashTimer = performance.now();
                spawnSparks(yawGroup.position);
                const gp = navigator.getGamepads()[0];
                if (gp && gp.vibrationActuator) {
                    gp.vibrationActuator.playEffect("dual-rumble", {
                        startDelay: 0,
                        duration: 200,         // very short burst (ms)
                        strongMagnitude: 1.0,  // max intensity
                        weakMagnitude: 0.6     // balance both motors
                    });
                } else {
                    console.log("❌ No vibration support on this platform.");
                }
                break;
              }
            }
          }
        }
        aiPlanes.forEach(plane => {
            const aiBox = new THREE.Box3().setFromObject(plane.mesh);
            if (planeBox.intersectsBox(aiBox)) {
              if (!crashed) {
                scene.remove(plane.mesh);
                crashed = true;
                speed = 0;
                pitchGroup.rotation.x = 0;
                pitchGroup.rotation.z = 0;
                crashTimer = performance.now();
                spawnSparks(yawGroup.position);
                const gp = navigator.getGamepads()[0];
                if (gp && gp.vibrationActuator) {
                    gp.vibrationActuator.playEffect("dual-rumble", {
                        startDelay: 0,
                        duration: 200,         // very short burst (ms)
                        strongMagnitude: 1.0,  // max intensity
                        weakMagnitude: 0.6     // balance both motors
                    });
                } else {
                    console.log("❌ No vibration support on this platform.");
                }
                return;
              } 
            }
        });

        lightningBolts.forEach(bolt => {
          const planeBox = new THREE.Box3().setFromObject(plane);
          const boltBox = new THREE.Box3().setFromObject(bolt);
          if (boltBox.intersectsBox(planeBox)) {
            spawnSparks(yawGroup.position);
            if (!crashed) {
              crashed = true;
              speed = 0;
              pitchGroup.rotation.x = 0;
              pitchGroup.rotation.z = 0;
              crashTimer = performance.now();
              spawnSparks(yawGroup.position);
              const gp = navigator.getGamepads()[0];
              if (gp && gp.vibrationActuator) {
                  gp.vibrationActuator.playEffect("dual-rumble", {
                      startDelay: 0,
                      duration: 200,         // very short burst (ms)
                      strongMagnitude: 1.0,  // max intensity
                      weakMagnitude: 0.6     // balance both motors
                  });
              } else {
                  console.log("❌ No vibration support on this platform.");
              }
              return;
            } 
          };   
        });
      }
    
      if (crashed) {
        yawGroup.position.y -= 0.2;
        if (yawGroup.position.y <= 0) {
          yawGroup.position.y = 0;
          velocityY = 0;
          if (performance.now() - crashTimer > 1000) {
              document.getElementById("game-over").style.display = "block";
              setTimeout(() => {
                document.getElementById("game-over").classList.add("show");
                document.getElementById("dangerWarning").style.display = "none";
              }, 50); // allows transition to kick in
              gameOver = true;
              speed = 0;
              document.getElementById("dangerWarning").style.display = "none";
          }
        }
      }
    
      // Spark update
      sparks.forEach((spark, i) => {
        spark.velocity.y -= 0.01;
        spark.position.add(spark.velocity);
        spark.material.opacity -= 0.01;
        if (spark.material.opacity <= 0) {
          scene.remove(spark);
          sparks.splice(i, 1);
        }
      });
    
      // Cloud recycling
      const planePos2D = new THREE.Vector2(yawGroup.position.x, yawGroup.position.z);
      clouds.forEach(cloud => {
        const cloudPos2D = new THREE.Vector2(cloud.position.x, cloud.position.z);
        const dist = planePos2D.distanceTo(cloudPos2D);
        if (dist > cloudSpawnRadius * 1.2) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * cloudSpawnRadius;
          cloud.position.x = yawGroup.position.x + Math.cos(angle) * distance;
          cloud.position.z = yawGroup.position.z + Math.sin(angle) * distance;
          cloud.position.y = Math.random() * 300 + 100;
        }
      });
      if (!lowPowerMode) {
        cloudGroup.children = cloudGroup.children.slice(0, 150);
      } else {
        cloudGroup.children = cloudGroup.children.slice(0, 50);
      }
    
      // HUD + camera
      const currentY = yawGroup.position.y;
      hudAltitude.textContent = `Altitude: ${currentY.toFixed(1)} m`;
      hudAltitude.style.color = currentY.toFixed(1) >= 10 ? "white" : "red";
    
      const currentPosition = new THREE.Vector3();
      yawGroup.getWorldPosition(currentPosition);
      const kmh = (speed * 60 * 60 * 3).toFixed(1);
      hudSpeed.textContent = `Speed: ${Math.round(kmh / 10)} km/h`;
      document.getElementById("speed").style.color = speed >= 0.14999999999999997 ? "white" : "red";
      lastPosition.copy(currentPosition);
    
      const planePos = new THREE.Vector3();
      plane.getWorldPosition(planePos);

      plane.add(camera);
      camera.position.set(0, 2, -6);
      camera.rotation.y = Math.PI; // ✅ Rotates camera 180° to face forward

      propeller.rotation.z += speed * 2;

      //other stuff
      const now = performance.now();

      if (currentY <= 10 && now - lastVibe > vibeCooldown) {
        triggerControllerAlert();
        lastVibe = now;
      }

      if (currentY <= 10) {
        document.getElementById("dangerWarning").style.display = "block";
      } else {
        document.getElementById("dangerWarning").style.display = "none";
      } 

      if (rain) {
          const targetOpacity = weatherState === "storm" ? 0.6 :
                                weatherState === "rain" ? 0.3 : 0;
          rain.material.opacity += (targetOpacity - rain.material.opacity) * 0.05;
          rain.visible = rain.material.opacity > 0.01;
        
          if (rain && rain.visible) {
            // Update position to follow plane
            const planePos = new THREE.Vector3();
            yawGroup.getWorldPosition(planePos);
            rain.position.set(
              planePos.x, 
              planePos.y, 
              planePos.z - 50
            );
            rain.rotation.set(
              0.2 * pitchGroup.rotation.x,
              yawGroup.rotation.y,
              pitchGroup.rotation.z * 0.5
            );

            const pos = rain.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              pos.array[i * 3 + 1] -= 4;
              if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 500;
            }
            pos.needsUpdate = true;
          }
      }

      for (const chunk of groundChunks) {
        if (!chunk.userData.birds) continue; // Skip chunks without birds
        for (const bird of chunk.userData.birds) {
          planeBox.setFromObject(plane);
          const birdBox = new THREE.Box3().setFromObject(bird.mesh);
          if (planeBox.intersectsBox(birdBox)) {
            createFeatherExplosion(bird.mesh.position); // 💥 POOF effect!
            scene.remove(bird.mesh); // Bird disappears after impact
          }
          bird.update(chunk.userData.birds, yawGroup); // Birds flock + react
        }
      }

      if (!lowPowerMode) {
        animateBirds();
        updateAIPlanes();
        cleanupAIPlanes(planePos2D);
        updateSmoke(); 
        updateCompassUI();
        updateWeatherEffects();
        MAX_AI_PLANES = 50
        chunkCount = 4;
        chunkSize = 500;
      } else {
        updateSmoke(); 
        updateCompassUI();
        cleanupAIPlanes(planePos2D);
        chunkSize = 200;
        chunkCount = 3;
        MAX_AI_PLANES = 0;
      }

      TWEEN.update();

      hudxyz.textContent = `X: ${Math.round(planePos.x)} Y: ${Math.round(planePos.y)} Z: ${Math.round(planePos.z)}`;     
      renderer.render(scene, camera);
    }
}
  
function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("lowPowerToggle").style.display = "none";
    document.getElementById("toggleLightning").style.display = "none";
    document.getElementById("lightningWarning").style.display = "none";
    document.getElementById("hud").style.display = "block";
    document.getElementById("controls").style.display = "block";
    document.getElementById("compassUI").style.display = "block";
    if (!lowPowerMode) {
      initRain();
      randomizeWeather();
      animate();
    } else {
      animate();
    }
}