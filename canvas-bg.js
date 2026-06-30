/* ==========================================
   3D PARTICLE MORPHING SPHERE BACKGROUND
   ========================================== */

const canvas = document.getElementById('canvas3d');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

const particles = [];
const NUM_PARTICLES = 3000; // Significantly increased particle count for dense particle cloud

// Helper to compute sphere radius dynamically (diameter takes up ~74% of viewport width)
function getBaseRadius() {
  // Clamp the effective width to a standard 16:9 aspect ratio relative to height.
  // This prevents the sphere from expanding excessively and looking sparse on ultrawide monitors.
  const effectiveWidth = Math.min(width, height * 1.77);
  return effectiveWidth * 0.80;
}

// Accumulated automatic rotation angles
let angleX = 0.0006;
let angleY = 0.0012;

// Mouse coordinates and lag parameters for smooth tilting
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const shockwaves = [];

// 3D Procedural Multi-Octave Noise Approximation
function getNoise3D(x, y, z, time) {
  // Octave 1: Slow, large waves
  let val = Math.sin(x * 1.8 + time * 0.0007) * Math.cos(y * 1.5 + time * 0.001) * Math.sin(z * 2.0 + time * 0.0006);
  // Octave 2: Medium lumps
  val += Math.sin(x * 3.5 - time * 0.0014) * Math.cos(z * 3.0 + time * 0.0009) * 0.35;
  // Octave 3: High-frequency ripples
  val += Math.cos(y * 6.0 + time * 0.0018) * Math.sin(z * 5.0 - time * 0.0015) * 0.15;
  return val;
}

// Track mouse position on the screen
window.addEventListener('mousemove', (e) => {
  mouse.targetX = (e.clientX - width / 2) * 0.000075;
  mouse.targetY = (e.clientY - height / 2) * 0.000075;
});

// Capture viewport clicks to spawn physical shockwaves in the particle cloud
window.addEventListener('click', (e) => {
  shockwaves.push({
    x: e.clientX,
    y: e.clientY,
    radius: 0,
    maxRadius: Math.max(width, height) * 0.55,
    speed: 12,
    force: 30 // Pulsing expansion force
  });
});

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

// Particle Class supporting 3D Sphere mapping and morphing projections
class Particle3D {
  constructor() {
    // Generate a uniform random point on a sphere surface (unit vector)
    this.theta = Math.random() * Math.PI * 2;
    this.phi = Math.acos(Math.random() * 2 - 1);

    this.xDir = Math.cos(this.theta) * Math.sin(this.phi);
    this.yDir = Math.sin(this.theta) * Math.sin(this.phi);
    this.zDir = Math.cos(this.phi);

    // Random drift speed along the surface of the sphere
    this.vTheta = (Math.random() - 0.5) * 0.0025; // longitude speed
    this.vPhi = (Math.random() - 0.5) * 0.0015;   // latitude speed

    this.baseSize = Math.random() * 1.6 + 0.9; // Increased dot size slightly
    
    // Antigravity themed pastels
    const colors = [
      '#6366f1', // Indigo
      '#38bdf8', // Light Cyan
      '#e2e8f0', // Clean Slate White
      '#ec4899', // Pink Accent
      '#a855f7'  // Purple
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];

    // Projection variables
    this.xProj = 0;
    this.yProj = 0;
    this.zProj = 0;
    this.scale = 0;
    
    // Dynamic offsets created by click shockwaves
    this.offsetX = 0;
    this.offsetY = 0;
  }

  // Rotate coordinates in 3D and project onto 2D screen
  project(rotX, rotY, timestamp) {
    // Crawl/drift dynamically across the surface of the sphere
    this.theta += this.vTheta;
    this.phi += this.vPhi;

    // Handle polar boundary crossings smoothly
    if (this.phi < 0) {
      this.phi = -this.phi;
      this.theta += Math.PI;
      this.vPhi = -this.vPhi;
    } else if (this.phi > Math.PI) {
      this.phi = 2 * Math.PI - this.phi;
      this.theta += Math.PI;
      this.vPhi = -this.vPhi;
    }
    this.theta = this.theta % (Math.PI * 2);

    // Update direction vectors based on new angles
    this.xDir = Math.cos(this.theta) * Math.sin(this.phi);
    this.yDir = Math.sin(this.theta) * Math.sin(this.phi);
    this.zDir = Math.cos(this.phi);

    const baseR = getBaseRadius();
    const noiseIntensity = baseR * 0.22; // Maximum deformation amplitude

    // Dynamic morphing radius based on noise
    const currentR = baseR + getNoise3D(this.xDir, this.yDir, this.zDir, timestamp) * noiseIntensity;

    // Calculate deformed 3D positions
    const px = this.xDir * currentR;
    const py = this.yDir * currentR;
    const pz = this.zDir * currentR;

    // 1. Rotation around Y-axis
    let xRotY = px * Math.cos(rotY) - pz * Math.sin(rotY);
    let zRotY = px * Math.sin(rotY) + pz * Math.cos(rotY);

    // 2. Rotation around X-axis
    let yRotX = py * Math.cos(rotX) - zRotY * Math.sin(rotX);
    let zRotX = py * Math.sin(rotX) + zRotY * Math.cos(rotX);

    // Project coordinates
    this.zProj = zRotX;
    
    // Dynamic Perspective math: scales with baseR to prevent front-clipping
    const fov = baseR * 1.5;
    const cameraDist = baseR * 1.65;
    this.scale = fov / (fov + this.zProj + cameraDist);
    this.xProj = (width / 2) + (xRotY * this.scale);
    this.yProj = (height / 2) + (yRotX * this.scale);

    // Apply cumulative shockwave displacements
    this.offsetX *= 0.88; // Friction decay
    this.offsetY *= 0.88;
    
    shockwaves.forEach(sw => {
      const dx = this.xProj - sw.x;
      const dy = this.yProj - sw.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // If the shockwave radius intersects this projected coordinate
        const diff = Math.abs(dist - sw.radius);
        if (diff < 40) {
          const pushIntensity = (1 - diff / 40) * (1 - sw.radius / sw.maxRadius) * sw.force;
          this.offsetX += (dx / dist) * pushIntensity;
          this.offsetY += (dy / dist) * pushIntensity;
        }
      }
    });

    // Update active coordinates
    this.xProj += this.offsetX;
    this.yProj += this.offsetY;
  }

  draw() {
    const baseR = getBaseRadius();
    // Map opacity to projected depth so background particles look faded
    const opacity = Math.max(0.08, Math.min(0.85, (this.zProj + baseR) / (baseR * 2.2)));
    
    ctx.fillStyle = this.color;
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    // Dot size scales with perspective depth
    ctx.arc(this.xProj, this.yProj, this.baseSize * this.scale * 1.85, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Generate the 3D particles pool
for (let i = 0; i < NUM_PARTICLES; i++) {
  particles.push(new Particle3D());
}

// Main animation loop
function render(timestamp) {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Smooth mouse movements transition lag
  mouse.x += (mouse.targetX - mouse.x) * 0.05;
  mouse.y += (mouse.targetY - mouse.y) * 0.05;

  // Increment base rotation angles
  const currentRotY = angleY + mouse.x;
  const currentRotX = angleX + mouse.y;
  
  // Incremental auto-rotation over time
  angleY += 0.0014;
  angleX += 0.0007;

  // 1. Update and propagate active click shockwaves
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += sw.speed;
    if (sw.radius > sw.maxRadius) {
      shockwaves.splice(i, 1); // Delete completed wave
    }
  }

  // 2. Project all coordinates
  particles.forEach(p => p.project(currentRotX, currentRotY, timestamp));

  // 3. Painter's Algorithm: Depth sort (furthest drawn first)
  particles.sort((a, b) => a.zProj - b.zProj);

  // 4. Draw sorted particles
  particles.forEach(p => p.draw());

  requestAnimationFrame(render);
}

// Start projection render loop
render(0);

// ==========================================
// INTERACTIVE CARD SPOTLIGHT GLOW EFFECT
// ==========================================
document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  });
});
