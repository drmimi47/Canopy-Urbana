let scene, camera, renderer, massing, controls;

let lotOutline = null; // Track the lot boundary
let farEnvelope = null; // Track the FAR envelope
let humanFigure = null; // Track the human scale figure
let shadowGround = null; // Track the shadow-receiving ground

// Add these globals for sun control
let sunLight = null;
let sunSphere = null;

// Initialize Three.js scene
function initScene() {
  const container = document.getElementById('canvas-container');
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  

  
// Camera
  camera = new THREE.PerspectiveCamera(
    100,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(150, 100, 150);
  camera.lookAt(0, 0, 0); // Look at origin where building sits
  
// Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  
  
  // OrbitControls - for zoom, pan, rotate
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // Smooth movement
  controls.dampingFactor = 0.2;
  controls.minDistance = 5; // Min zoom
  controls.maxDistance = 1000; // Max zoom
  controls.maxPolarAngle = Math.PI / 2; // Prevent going below ground

    // 🌞 SUN + SKY LIGHTING

    // Soft ambient (sky bounce light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // 🌤 Subtle rim light to define edges
const rimLight = new THREE.DirectionalLight(0xffffff, 0.25);
rimLight.position.set(-200, 150, -200);
scene.add(rimLight);


    // Sun (Directional Light)
    sunLight = new THREE.DirectionalLight(0xfff2cc, 1.2);
    sunLight.position.set(200, 300, 100); // Sun position
    sunLight.target.position.set(0, 0, 0);

    sunLight.castShadow = true;

    const hemiLight = new THREE.HemisphereLight(
    0xffffff, // sky
    0xffffff, // ground bounce
    0.35
);
scene.add(hemiLight);


    // Shadow quality
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 800;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;

    // 🔧 Shadow bias fixes acne + fuzz
sunLight.shadow.bias = -0.00015;
sunLight.shadow.normalBias = 0.02;

    scene.add(sunLight);
    scene.add(sunLight.target);

// ☀️ Visual Sun Sphere (helper)
sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffdd88 })
);
sunSphere.position.copy(sunLight.position);
scene.add(sunSphere);


  
  // Grid helper (lot context) - at ground level (y=0)
  const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
  gridHelper.position.y = -0.05; // Ensure it's at ground level
  scene.add(gridHelper);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.10;

  
  // Axes helper - positioned at origin on ground
  const axesHelper = new THREE.AxesHelper(50);
  axesHelper.position.y = 0.05; // Slightly above grid to be visible
  scene.add(axesHelper);
  axesHelper.material.transparent = true;
  axesHelper.material.opacity = 0.35;

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  
  // Load human scale figure
  loadHumanFigure();
  
  // Create 6-foot reference box (DELETE THIS LINE WHEN DONE CALIBRATING)
  // createReferenceBox();
  
  animate();
}


// Load human scale figure
function loadHumanFigure() {
  const loader = new THREE.GLTFLoader();
  
  loader.load(
    'assets/human.glb',
    (gltf) => {
      humanFigure = gltf.scene;
      
      // Get bounding box to find bottom of model
      const bbox = new THREE.Box3().setFromObject(humanFigure);
      const currentHeight = bbox.max.y - bbox.min.y;
      
      // Scale if needed (assuming figure should be 6ft tall)
      const targetHeight = 6; // 6 feet tall
      const scale = targetHeight / currentHeight;
      humanFigure.scale.set(scale, scale, scale);
      
      // Recalculate bbox after scaling
      bbox.setFromObject(humanFigure);
      
      // Position so the bottom of the model is at y=0 (ground level)
      const yOffset = -bbox.min.y;
      humanFigure.position.set(0, yOffset, 0);
      
      scene.add(humanFigure);
        humanFigure.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;       // keep shadows
                obj.receiveShadow = true;    // keep shadows
                obj.renderOrder = 1;         // same as canopy/tubes
                obj.material.depthWrite = false;  // IMPORTANT: allows blending with ghosted FAR envelope
                obj.material.transparent = true; // even if opacity = 1

            }
        });


      console.log('Human figure loaded and positioned on ground');
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
      console.error('Error loading human figure:', error);
    }
  );
}

// Create 6-foot reference box for scale calibration
function createReferenceBox() {
  const boxHeight = 6; // 6 feet
  const boxWidth = 2;  // 2 feet wide
  const boxDepth = 1;  // 1 foot deep
  
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.15,
    wireframe: false
  });
  
  const referenceBox = new THREE.Mesh(geometry, material);
  
  // Position so base touches ground (y=0)
  referenceBox.position.set(0, boxHeight / 2, 0);
  
  // Add wireframe
  const wireframe = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
  );
  wireframe.position.copy(referenceBox.position);
  
  scene.add(referenceBox);
  scene.add(wireframe);
  
  console.log('6-foot reference box created at origin');
}

function updateSunPosition(angleDeg) {
  if (!sunLight || !sunSphere) return;

  const radius = 400;  // distance of sun from origin
  const height = 300;  // fixed elevation for now

  const angleRad = THREE.MathUtils.degToRad(angleDeg);

  const x = Math.cos(angleRad) * radius;
  const z = Math.sin(angleRad) * radius;

  sunLight.position.set(x, height, z);
  sunLight.target.position.set(0, 0, 0);
  sunLight.target.updateMatrixWorld();

  sunSphere.position.copy(sunLight.position);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.update();
  
  // 🔧 NEW: Make human figure face the camera
  if (humanFigure) {
    humanFigure.lookAt(camera.position);
  }
  
  renderer.render(scene, camera);
}

// Create 3D canopy from vertices and faces
function createMassing(
  canopyData,
  color = 0x4CAF50,
  opacity = 0.0,
  wireColor = 0xcccccc,    // 🔧 Changed to light gray
  wireOpacity = 0.95,       // 🔧 More opaque
  tubeRadius = 0.15        // 🔧 NEW: Thickness of structural members in feet
) {

  // Remove old massing
  if (massing) {
    scene.remove(massing);
  }

  // Create geometry from vertices and faces
  const geometry = new THREE.BufferGeometry();

  // Flatten vertices array
  const positions = new Float32Array(canopyData.vertices.flat());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Flatten faces array
  const indices = new Uint16Array(canopyData.faces.flat());
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  // Compute normals for lighting
  geometry.computeVertexNormals();

// 🌿 MAIN SURFACE MATERIAL - with depth settings to prevent clipping
  const material = new THREE.MeshPhongMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    flatShading: false,
    depthWrite: false  // 🔧 NEW: Prevents transparent surface from blocking tubes
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;  // 🔧 NEW: Render surface first
// 🔧 ADD: subtle edge outline to preserve silhouette in shadows
const edges = new THREE.EdgesGeometry(mesh.geometry);
const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.12
    })
);

// Prevent edges from z-fighting with surface
edgeLines.renderOrder = 3;

mesh.add(edgeLines);


// 🔧 CREATE TUBULAR STRUCTURE - FULL GRID (not just edges)
  const tubeMaterial = new THREE.MeshPhongMaterial({
    color: 0xaaaaaa, //was wireColor,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: wireOpacity,
    depthWrite: true
  });

  const tubesGroup = new THREE.Group();

  // Extract the grid structure from vertices
  // Assuming vertices are organized in rows (this matches backend generation)
  const vertexArray = canopyData.vertices;
  
  // Calculate grid dimensions from vertex count
  const totalVertices = vertexArray.length / 2; // Divide by 2 (top + bottom)
  const gridSize = Math.sqrt(totalVertices);
  const segmentsX = gridSize - 1;
  const segmentsZ = gridSize - 1;

  // Helper function to create tube between two points
  function createTube(start, end) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    if (length < 0.01) return; // Skip zero-length tubes
    
    const orientation = new THREE.Matrix4();
    orientation.lookAt(start, end, new THREE.Object3D().up);
    orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

    const tubeGeometry = new THREE.CylinderGeometry(
      tubeRadius,
      tubeRadius,
      length,
      6  // Radial segments
    );
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.copy(start.clone().add(direction.multiplyScalar(0.5)));
    tube.rotation.setFromRotationMatrix(orientation);
    tube.renderOrder = 2;

    tubesGroup.add(tube);
  }

  // Create horizontal grid lines (X direction) for TOP surface
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x < segmentsX; x++) {
      const idx1 = z * (segmentsX + 1) + x;
      const idx2 = z * (segmentsX + 1) + x + 1;
      
      const start = new THREE.Vector3(...vertexArray[idx1]);
      const end = new THREE.Vector3(...vertexArray[idx2]);
      createTube(start, end);
    }
  }

  // Create horizontal grid lines (Z direction) for TOP surface
  for (let x = 0; x <= segmentsX; x++) {
    for (let z = 0; z < segmentsZ; z++) {
      const idx1 = z * (segmentsX + 1) + x;
      const idx2 = (z + 1) * (segmentsX + 1) + x;
      
      const start = new THREE.Vector3(...vertexArray[idx1]);
      const end = new THREE.Vector3(...vertexArray[idx2]);
      createTube(start, end);
    }
  }

  // 🔧 NEW: Create horizontal grid lines (X direction) for BOTTOM surface
  const bottomOffset = totalVertices;
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x < segmentsX; x++) {
      const idx1 = z * (segmentsX + 1) + x + bottomOffset;
      const idx2 = z * (segmentsX + 1) + x + 1 + bottomOffset;
      
      const start = new THREE.Vector3(...vertexArray[idx1]);
      const end = new THREE.Vector3(...vertexArray[idx2]);
      createTube(start, end);
    }
  }

  // 🔧 NEW: Create horizontal grid lines (Z direction) for BOTTOM surface
  for (let x = 0; x <= segmentsX; x++) {
    for (let z = 0; z < segmentsZ; z++) {
      const idx1 = z * (segmentsX + 1) + x + bottomOffset;
      const idx2 = (z + 1) * (segmentsX + 1) + x + bottomOffset;
      
      const start = new THREE.Vector3(...vertexArray[idx1]);
      const end = new THREE.Vector3(...vertexArray[idx2]);
      createTube(start, end);
    }
  }

// Create vertical struts (connecting top to bottom)
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x <= segmentsX; x++) {
      const idx = z * (segmentsX + 1) + x;
      
      const top = new THREE.Vector3(...vertexArray[idx]);
      const bottom = new THREE.Vector3(...vertexArray[idx + bottomOffset]);
      createTube(top, bottom);
    }
  }

// 🔧 NEW: Create diagonal bracing - N pattern between vertical columns
  const diagonalRadius = tubeRadius * 0.7; // Thinner diagonals
  
  function createDiagonalTube(start, end) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    if (length < 0.01) return;
    
    const orientation = new THREE.Matrix4();
    orientation.lookAt(start, end, new THREE.Object3D().up);
    orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

    const tubeGeometry = new THREE.CylinderGeometry(
      diagonalRadius,
      diagonalRadius,
      length,
      6
    );
    
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.copy(start.clone().add(direction.multiplyScalar(0.5)));
    tube.rotation.setFromRotationMatrix(orientation);
    tube.renderOrder = 2;

    tubesGroup.add(tube);
  }

  // Diagonal bracing in X direction (creates N pattern when viewed from side)
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x < segmentsX; x++) {
      const idx1 = z * (segmentsX + 1) + x;
      const idx2 = z * (segmentsX + 1) + x + 1;
      
      // Get top and bottom points for both columns
      const topLeft = new THREE.Vector3(...vertexArray[idx1]);
      const botLeft = new THREE.Vector3(...vertexArray[idx1 + bottomOffset]);
      const topRight = new THREE.Vector3(...vertexArray[idx2]);
      const botRight = new THREE.Vector3(...vertexArray[idx2 + bottomOffset]);
      
      // Create diagonal: bottom-left to top-right (/)
      createDiagonalTube(botLeft, topRight);
      
      // Create diagonal: top-left to bottom-right (\)
      //createDiagonalTube(topLeft, botRight);
    }
  }

// Diagonal bracing in Z direction (creates N pattern when viewed from front)
  for (let x = 0; x <= segmentsX; x++) {
    for (let z = 0; z < segmentsZ; z++) {
      const idx1 = z * (segmentsX + 1) + x;
      const idx2 = (z + 1) * (segmentsX + 1) + x;
      
      // Get top and bottom points for both columns
      const topFront = new THREE.Vector3(...vertexArray[idx1]);
      const botFront = new THREE.Vector3(...vertexArray[idx1 + bottomOffset]);
      const topBack = new THREE.Vector3(...vertexArray[idx2]);
      const botBack = new THREE.Vector3(...vertexArray[idx2 + bottomOffset]);
      
      // Create diagonal: bottom-front to top-back (/)
      createDiagonalTube(botFront, topBack);
      
      // Create diagonal: top-front to bottom-back (\)
      //createDiagonalTube(topFront, botBack);
    }
  }

// 🔧 NEW: Create large rectangular columns with diagonal tree-like supports
function createCornerColumns() {
    const columnWidth = tubeRadius * 34;  // Rectangular column width
    const columnDepth = tubeRadius * 34;  // Rectangular column depth
    const diagonalRadius = tubeRadius * 3; // Thicker diagonals

    const columnMaterial = new THREE.MeshPhongMaterial({
        color: wireColor,
        transparent: true,
        opacity: wireOpacity,
        depthWrite: true
    });

    //// Offset deeper into lot (2-3 grid cells) to allow diagonals to spread
    const offsetX = 7;
    const offsetZ = 7;

    // Define 4 corner positions (further inward)
    const corners = [
        { x: offsetX, z: offsetZ },                           // Front-left
        { x: segmentsX - offsetX, z: offsetZ },               // Front-right
        { x: offsetX, z: segmentsZ - offsetZ },               // Back-left
        { x: segmentsX - offsetX, z: segmentsZ - offsetZ }    // Back-right
    ];

    corners.forEach(corner => {
        const centerIdx = corner.z * (segmentsX + 1) + corner.x;

        // Get center bottom point of space frame
        const spaceFrameBottom = new THREE.Vector3(...vertexArray[centerIdx + bottomOffset]);

        //// Column top is 8 feet BELOW the space frame bottom
        const columnExtension = 11; // Gap between column top and space frame
        const columnTopHeight = spaceFrameBottom.y - columnExtension;

        // Column goes from ground (y=0) to columnTopHeight
        const columnHeight = columnTopHeight;

        // Create rectangular column
        const columnGeometry = new THREE.BoxGeometry(
            columnWidth,
            columnHeight,
            columnDepth
        );

        const column = new THREE.Mesh(columnGeometry, columnMaterial);


        
        // Position column so base is at ground (y=0)
        column.position.set(spaceFrameBottom.x, columnHeight / 2, spaceFrameBottom.z);
        column.renderOrder = 2;

        tubesGroup.add(column);

        // Top center of column where all diagonals meet
        const columnTopPoint = new THREE.Vector3(
            spaceFrameBottom.x, 
            columnTopHeight, 
            spaceFrameBottom.z
        );

        //// Create diagonal supports from column top UP to space frame nodes
        const spreadRadius = 4; // How many grid cells to spread diagonals

        // Only 4 corners of the spread square
        const cornerOffsets = [
            { dx: -spreadRadius, dz: -spreadRadius }, // back-left
            { dx: -spreadRadius, dz:  spreadRadius }, // front-left
            { dx:  spreadRadius, dz: -spreadRadius }, // back-right
            { dx:  spreadRadius, dz:  spreadRadius }  // front-right
        ];

        cornerOffsets.forEach(offset => {
            const targetX = corner.x + offset.dx;
            const targetZ = corner.z + offset.dz;

            // Skip if outside grid bounds
            if (targetX < 0 || targetX > segmentsX || targetZ < 0 || targetZ > segmentsZ) return;

            const targetIdx = targetZ * (segmentsX + 1) + targetX;

            // Connect to BOTTOM surface of space frame
            const spaceFrameNode = new THREE.Vector3(...vertexArray[targetIdx + bottomOffset]);

            // Create diagonal from column top to space frame node
            const direction = new THREE.Vector3().subVectors(spaceFrameNode, columnTopPoint);
            const length = direction.length();

            if (length < 0.01) return;

            const orientation = new THREE.Matrix4();
            orientation.lookAt(columnTopPoint, spaceFrameNode, new THREE.Object3D().up);
            orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

            const diagonalGeometry = new THREE.CylinderGeometry(
                diagonalRadius,
                diagonalRadius,
                length,
                12  // Smoother cylinders for main diagonals
            );

            const diagonal = new THREE.Mesh(diagonalGeometry, columnMaterial);
            diagonal.position.copy(columnTopPoint.clone().add(direction.multiplyScalar(0.5)));
            diagonal.rotation.setFromRotationMatrix(orientation);
            diagonal.renderOrder = 2;

            tubesGroup.add(diagonal);
        });
    });
}

// Call the function once
createCornerColumns();

  // Group mesh + tubes
  massing = new THREE.Group();
  // Group mesh + tubes
  massing = new THREE.Group();
  massing.add(mesh);
  massing.add(tubesGroup);

  scene.add(massing);

    // 🌑 Enable shadows for all tubes
    tubesGroup.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });


}

// Create lot boundary outline
function createLotOutline(lotWidth, lotDepth) {
  // Remove old lot outline
  if (lotOutline) {
    scene.remove(lotOutline);
  }
  
  // 🔧 FIXED: Remove old shadow ground before creating new one
  if (shadowGround) {
    scene.remove(shadowGround);
  }
  
  // 🔧 NEW: Large invisible shadow-receiving ground (extends beyond lot)
  const shadowGroundSize = 400; // Large enough to catch all shadows
  const shadowGroundGeometry = new THREE.PlaneGeometry(shadowGroundSize, shadowGroundSize);
  const shadowGroundMaterial = new THREE.ShadowMaterial({
    opacity: 0.3 // Only shows shadows, ground is invisible
  });
  
  shadowGround = new THREE.Mesh(shadowGroundGeometry, shadowGroundMaterial);
  shadowGround.rotation.x = -Math.PI / 2;
  shadowGround.position.y = 0; // At ground level
  shadowGround.receiveShadow = true;
  scene.add(shadowGround);
  
  // 🔧 REMOVED: No visible lot ground plane needed anymore
  // Only the boundary line will be visible
  
  // Create lot boundary rectangle
  const shape = new THREE.Shape();
  shape.moveTo(-lotWidth/2, -lotDepth/2);
  shape.lineTo(lotWidth/2, -lotDepth/2);
  shape.lineTo(lotWidth/2, lotDepth/2);
  shape.lineTo(-lotWidth/2, lotDepth/2);
  shape.lineTo(-lotWidth/2, -lotDepth/2);
  
  const points = shape.getPoints();
  const geometryPoints = new THREE.BufferGeometry().setFromPoints(points);
  
  const lotLine = new THREE.Line(
    geometryPoints,
    new THREE.LineBasicMaterial({
      color: 0x808080,
      linewidth: 1,
      transparent: true,
      opacity: 0.8  // Slightly transparent line
    })
  );
  lotLine.rotation.x = -Math.PI / 2;
  lotLine.position.y = 0.02; // Just above shadow ground
  
  // Group just the boundary line
  lotOutline = new THREE.Group();
  lotOutline.add(lotLine);
  
  scene.add(lotOutline);
}

// Create FAR envelope - shows maximum buildable volume
function createFAREnvelope(envelopeWidth, envelopeDepth, envelopeHeight) {
  // Remove old envelope
  if (farEnvelope) {
    scene.remove(farEnvelope);
  }
  
  // Create envelope geometry
  const envelopeGeometry = new THREE.BoxGeometry(
    envelopeWidth, 
    envelopeHeight, 
    envelopeDepth
  );
  
///////// Ghosted material box FAR envelope
  const envelopeMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false  // 🔧 ADD THIS
  });
  
  const envelopeMesh = new THREE.Mesh(envelopeGeometry, envelopeMaterial);
  envelopeMesh.position.y = envelopeHeight / 2;
  envelopeMesh.renderOrder = 0;  // 🔧 ADD THIS - render first
  
  //////// Wireframe for the envelope
  const wireframeGeometry = new THREE.EdgesGeometry(envelopeGeometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.9,
    linewidth: 1
  });
  const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
  wireframe.position.y = envelopeHeight / 2;
  
  // Group them together
  farEnvelope = new THREE.Group();
  farEnvelope.add(envelopeMesh);
  farEnvelope.add(wireframe);
  
  scene.add(farEnvelope);
}

async function generateMassing() {
  const lotWidth = parseFloat(document.getElementById('lotWidth').value);
  const lotDepth = parseFloat(document.getElementById('lotDepth').value);
  const zoningDistrict = document.getElementById('zoningDistrict').value;
  
  try {
    const response = await fetch('http://localhost:3000/api/generate-massing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lotWidth, lotDepth, zoningDistrict })
    });
    
    const data = await response.json();
    
    // Create lot outline first (so it's behind everything)
    createLotOutline(lotWidth, lotDepth);
    
    // Create FAR envelope (ghosted maximum volume)
    createFAREnvelope(
      data.envelope.width,
      data.envelope.depth,
      data.envelope.height
    );
    
    // Create parametric canopy
    createMassing(data.canopy);
    
    // Display info
    const infoPanel = document.getElementById('info');
    infoPanel.innerHTML = `
      <h3>Parametric Canopy</h3>
      <strong>Form:</strong> ${data.canopy.description}<br>
      Shell Thickness: ${data.zoning.shell_thickness} ft<br><br>
      
      <strong>Envelope:</strong><br>
      Width: ${data.envelope.width.toFixed(1)} ft<br>
      Depth: ${data.envelope.depth.toFixed(1)} ft<br>
      Max Height: ${data.envelope.height.toFixed(1)} ft<br><br>
      
      <strong>Zoning Analysis:</strong><br>
      District: ${data.zoning.district}<br>
      Lot Area: ${data.zoning.lot_area} sq ft<br>
      Max FAR: ${data.zoning.max_far}<br>
      Calculated FAR: ${data.zoning.calculated_far}<br>
      Max GFA: ${data.zoning.max_gfa} sq ft<br>
      Approx GFA: ${data.zoning.actual_gfa} sq ft<br><br>
      
      <strong>Visualization:</strong><br>
      <span style="color: #cf1f1f;">Red volume</span> = Max FAR envelope<br>
      <span style="color: #000000;">Black outline</span> = Defined lot boundary
    `;
    
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to generate massing. Make sure the API server is running.');
  }
}

// Initialize
initScene();


// Event listeners
document.getElementById('generateBtn').addEventListener('click', generateMassing);

// Generate initial massing
generateMassing();

document.getElementById('sunSlider').addEventListener('input', (e) => {
  updateSunPosition(parseFloat(e.target.value));
});

updateSunPosition(parseFloat(document.getElementById('sunSlider').value));

// 🔧 NEW: FAR Envelope toggle
document.getElementById('envelopeToggle').addEventListener('click', () => {
  if (farEnvelope) {
    farEnvelope.visible = !farEnvelope.visible;
    const btn = document.getElementById('envelopeToggle');
    btn.textContent = farEnvelope.visible ? 'Hide FAR Envelope' : 'Show FAR Envelope';
    btn.style.background = farEnvelope.visible ? '#666' : '#E24A4A';
  }
});