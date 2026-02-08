const express = require('express');
const cors = require('cors');
const zoningRules = require('./zoning-rules.json');

const app = express();
app.use(cors());
app.use(express.json());

const FLOOR_HEIGHT = 12;

// Helper: Generate wave-based canopy geometry
function generateCanopy(envelopeWidth, envelopeDepth, envelopeHeight, maxVolume, seed) {
  // Randomize wave parameters based on seed
  const waveFrequencyX = 0.5 + seed * 0.5;
  const waveFrequencyZ = 0.5 + (1 - seed) * 0.5;
  const waveAmplitude = envelopeHeight * (0.25 + seed * 0.25);
  const baseHeight = envelopeHeight * (0.3 + seed * 0.3);
  
// Grid resolution based on envelope size (one segment every ~5-8 feet)
  const segmentsX = 30; // Very dense
  const segmentsZ = 30; // Very dense

  // Generate vertices for top surface (wave-deformed)
  const topVertices = [];
  const bottomVertices = [];
  
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x <= segmentsX; x++) {
      const xPos = (x / segmentsX - 0.5) * envelopeWidth;
      const zPos = (z / segmentsZ - 0.5) * envelopeDepth;
      
      // Wave function for height modulation
      const normX = x / segmentsX;
      const normZ = z / segmentsZ;
// --- LOCAL VARIATION PARAMETERS (per canopy) ---
const phaseX = seed * Math.PI * 2;
const phaseZ = (1 - seed) * Math.PI * 2;
const skew = (seed - 0.5) * 0.8; // directional bias

// Distance from center (for falloff / lift)
const dx = normX - 0.5;
const dz = normZ - 0.5;
const dist = Math.sqrt(dx * dx + dz * dz);

// Primary wave (skewed + phase-shifted)
const wave1 =
  Math.sin((normX + skew * dz) * Math.PI * waveFrequencyX + phaseX) *
  Math.sin((normZ + skew * dx) * Math.PI * waveFrequencyZ + phaseZ);

// Secondary ripple (localized)
const wave2 =
  Math.sin(normX * Math.PI * waveFrequencyX * (1.8 + seed)) *
  Math.sin(normZ * Math.PI * waveFrequencyZ * (1.3 + seed)) *
  (0.25 + 0.15 * seed);

// Radial modulation (breaks flat saddles)
const radialMod = Math.cos(dist * Math.PI * (1.5 + seed)) * 0.4;

// Edge lift (spaceframe-friendly)
const edgeLift = dist * waveAmplitude * (0.3 + seed * 0.3);

// Combine all effects
const wave = wave1 + wave2 + radialMod;

// Final height
const yTop =
  baseHeight +
  wave * waveAmplitude * (1 - dist * 0.6) + // dampen near edges
  edgeLift;
      const shellThickness = 5.5; // 3 feet thick shell
      const yBottom = yTop - shellThickness;
      
      topVertices.push([xPos, yTop, zPos]);
      bottomVertices.push([xPos, yBottom, zPos]);
    }
  }
  
  // Generate faces (triangulate the grid)
  const faces = [];
  for (let z = 0; z < segmentsZ; z++) {
    for (let x = 0; x < segmentsX; x++) {
      const i = z * (segmentsX + 1) + x;
      const i1 = i;
      const i2 = i + 1;
      const i3 = i + (segmentsX + 1);
      const i4 = i + (segmentsX + 1) + 1;
      
      // Top surface triangles
      faces.push([i1, i2, i3]);
      faces.push([i2, i4, i3]);
      
      // Bottom surface triangles (offset by vertex count)
      const offset = topVertices.length;
      faces.push([i1 + offset, i3 + offset, i2 + offset]);
      faces.push([i2 + offset, i3 + offset, i4 + offset]);
    }
  }
  
  // Add side faces to close the shell
  for (let x = 0; x < segmentsX; x++) {
    // Front edge
    const i1 = x;
    const i2 = x + 1;
    faces.push([i1, i2, i1 + topVertices.length]);
    faces.push([i2, i2 + topVertices.length, i1 + topVertices.length]);
    
    // Back edge
    const j1 = segmentsZ * (segmentsX + 1) + x;
    const j2 = j1 + 1;
    faces.push([j1, j1 + topVertices.length, j2]);
    faces.push([j2, j1 + topVertices.length, j2 + topVertices.length]);
  }
  
  for (let z = 0; z < segmentsZ; z++) {
    // Left edge
    const i1 = z * (segmentsX + 1);
    const i2 = (z + 1) * (segmentsX + 1);
    faces.push([i1, i1 + topVertices.length, i2]);
    faces.push([i2, i1 + topVertices.length, i2 + topVertices.length]);
    
    // Right edge
    const j1 = z * (segmentsX + 1) + segmentsX;
    const j2 = (z + 1) * (segmentsX + 1) + segmentsX;
    faces.push([j1, j2, j1 + topVertices.length]);
    faces.push([j2, j2 + topVertices.length, j1 + topVertices.length]);
  }
  
  return {
    vertices: [...topVertices, ...bottomVertices],
    faces,
    description: `Wave canopy (freq: ${waveFrequencyX.toFixed(2)}, ${waveFrequencyZ.toFixed(2)})`
  };
}

// API Endpoint: Generate massing from lot + zoning
app.post('/api/generate-massing', (req, res) => {
  const { lotWidth, lotDepth, zoningDistrict } = req.body;

  const rules = zoningRules[zoningDistrict];
  if (!rules) {
    return res.status(400).json({ error: 'Invalid zoning district' });
  }

  // --- BASIC CALCULATIONS ---
  const lotArea = lotWidth * lotDepth;
  const maxGFA = lotArea * rules.max_far;
  const maxVolume = maxGFA * FLOOR_HEIGHT;

  // --- BUILDABLE ENVELOPE ---
  const envelopeWidth = lotWidth - (rules.front_setback + rules.rear_setback);
  const envelopeDepth = lotDepth - (rules.side_setback * 2);
  const envelopeHeight = rules.max_height;

  // Safety check
  if (envelopeWidth <= 0 || envelopeDepth <= 0) {
    return res.status(400).json({ error: 'Invalid setbacks for lot size' });
  }

  // Generate random seed for variation
  const seed = Math.random();

  // Generate canopy geometry
  const canopy = generateCanopy(envelopeWidth, envelopeDepth, envelopeHeight, maxVolume, seed);

  // Calculate approximate volume (shell thickness × surface area)
  const shellThickness = 3;
  const approxFootprint = envelopeWidth * envelopeDepth;
  const approxVolume = approxFootprint * shellThickness;
  const approxGFA = approxVolume / FLOOR_HEIGHT;
  const approxFAR = approxGFA / lotArea;

  // --- RESPONSE ---
  res.json({
    typology: 'parametric_canopy',
    canopy: {
      vertices: canopy.vertices,
      faces: canopy.faces,
      description: canopy.description
    },
    envelope: {
      width: envelopeWidth,
      depth: envelopeDepth,
      height: envelopeHeight
    },
    zoning: {
      district: zoningDistrict,
      max_far: rules.max_far,
      calculated_far: approxFAR.toFixed(2),
      max_height: rules.max_height,
      lot_area: lotArea.toFixed(0),
      max_gfa: maxGFA.toFixed(0),
      actual_gfa: approxGFA.toFixed(0),
      shell_thickness: shellThickness
    }
  });
});

// Get available zoning districts
app.get('/api/zoning-districts', (req, res) => {
  res.json(Object.keys(zoningRules));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});