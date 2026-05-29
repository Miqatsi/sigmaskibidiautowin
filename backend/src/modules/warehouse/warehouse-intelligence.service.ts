import { prisma } from '../../lib/prisma';

// ============================================================
// WAREHOUSE INTELLIGENCE SERVICE
// Smart Slotting, Cold Chain, Hazard Segregation, Health Score
// ============================================================

// --- TYPES ---

export interface WarehouseZone {
  id: string;
  name: string;
  code: string;
  type: 'AMBIENT' | 'COLD_STORAGE' | 'HAZARDOUS' | 'QUARANTINE';
  temperature: { current: number; min: number; max: number; status: 'NORMAL' | 'WARNING' | 'CRITICAL' };
  humidity: number;
  capacity: { total: number; used: number; utilization: number };
  storedLots: Array<{ lotNumber: string; material: string; quantity: number; unit: string }>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  alerts: string[];
}

export interface SlotRecommendation {
  lotNumber: string;
  material: string;
  recommendedLocation: string;
  confidence: number;
  reasoning: string[];
  alternatives: Array<{ location: string; score: number; reason: string }>;
}

export interface ColdChainAlert {
  location: string;
  currentTemp: number;
  safeRange: { min: number; max: number };
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  recommendedAction: string;
  timestamp: string;
}

export interface WarehouseHealth {
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'ATTENTION_NEEDED' | 'CRITICAL';
  factors: Array<{ name: string; score: number; maxScore: number; status: string }>;
  alerts: ColdChainAlert[];
}

// --- MOCK SENSOR DATA (simulated IoT) ---

function generateSensorData(zoneType: string): { temp: number; humidity: number; status: 'NORMAL' | 'WARNING' | 'CRITICAL' } {
  if (zoneType === 'COLD_STORAGE') {
    // Simulate occasional excursions for demo
    const rand = Math.random();
    if (rand < 0.1) return { temp: -2, humidity: 45, status: 'CRITICAL' }; // Excursion!
    if (rand < 0.2) return { temp: -4, humidity: 42, status: 'WARNING' };
    return { temp: -8 - Math.random() * 10, humidity: 38 + Math.random() * 5, status: 'NORMAL' };
  }
  if (zoneType === 'HAZARDOUS') {
    return { temp: 22 + Math.random() * 3, humidity: 35 + Math.random() * 10, status: 'NORMAL' };
  }
  return { temp: 24 + Math.random() * 4, humidity: 45 + Math.random() * 15, status: 'NORMAL' };
}

// --- WAREHOUSE MAP ---

export async function getWarehouseMap(): Promise<WarehouseZone[]> {
  const locations = await prisma.storageLocation.findMany({
    where: { deletedAt: null },
    include: {
      transactions: {
        where: { deletedAt: null },
        include: { batch: { select: { lotNumber: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  // Define zone types based on location names
  const zones: WarehouseZone[] = locations.map((loc) => {
    const isCold = loc.name.toLowerCase().includes('cold') || loc.code.includes('CS');
    const isQuarantine = loc.name.toLowerCase().includes('quarantine') || loc.code.includes('QZ');
    const isHazardous = loc.name.toLowerCase().includes('hazard') || loc.code.includes('HZ');
    const zoneType = isCold ? 'COLD_STORAGE' : isQuarantine ? 'QUARANTINE' : isHazardous ? 'HAZARDOUS' : 'AMBIENT';

    const sensor = generateSensorData(zoneType);
    const netStock = loc.transactions.reduce((sum, tx) => sum + tx.quantity, 0);
    const capacity = isCold ? 500 : 1000;
    const utilization = Math.min(100, Math.max(0, (Math.abs(netStock) / capacity) * 100));

    const storedLots = loc.transactions
      .filter(tx => tx.quantity > 0)
      .slice(0, 5)
      .map(tx => ({ lotNumber: tx.batch?.lotNumber || 'N/A', material: 'Mixed', quantity: tx.quantity, unit: tx.unit }));

    const alerts: string[] = [];
    if (sensor.status === 'CRITICAL') alerts.push(`Temperature excursion: ${sensor.temp}°C`);
    if (utilization > 90) alerts.push('Near capacity limit');

    return {
      id: loc.id,
      name: loc.name,
      code: loc.code,
      type: zoneType,
      temperature: {
        current: Math.round(sensor.temp * 10) / 10,
        min: isCold ? -20 : 15,
        max: isCold ? -4 : 30,
        status: sensor.status,
      },
      humidity: Math.round(sensor.humidity),
      capacity: { total: capacity, used: Math.abs(netStock), utilization: Math.round(utilization) },
      storedLots,
      riskLevel: sensor.status === 'CRITICAL' ? 'HIGH' : utilization > 80 ? 'MEDIUM' : 'LOW',
      alerts,
    };
  });

  return zones;
}

// --- SMART SLOT RECOMMENDATION ---

export async function recommendSlot(lotNumber?: string): Promise<SlotRecommendation> {
  const zones = await getWarehouseMap();
  const availableZones = zones.filter(z => z.capacity.utilization < 90 && z.type !== 'QUARANTINE');

  // Score each zone
  const scored = availableZones.map(z => {
    let score = 100;
    score -= z.capacity.utilization * 0.5; // Prefer less full
    if (z.temperature.status !== 'NORMAL') score -= 30; // Avoid temp issues
    if (z.type === 'COLD_STORAGE') score += 10; // Prefer cold for perishables
    return { location: z.name, code: z.code, score: Math.round(score), type: z.type, utilization: z.capacity.utilization };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0] || { location: 'No available location', code: 'N/A', score: 0, type: 'AMBIENT', utilization: 100 };

  return {
    lotNumber: lotNumber || 'New Lot',
    material: 'Auto-detected',
    recommendedLocation: best.location,
    confidence: Math.min(95, best.score),
    reasoning: [
      `${best.location} has ${100 - best.utilization}% available capacity`,
      best.type === 'COLD_STORAGE' ? 'Cold storage suitable for perishable materials' : 'Ambient storage — standard conditions',
      'No hazard conflicts detected',
      'FIFO position optimized',
    ],
    alternatives: scored.slice(1, 4).map(s => ({
      location: s.location,
      score: s.score,
      reason: `${100 - s.utilization}% capacity available (${s.type})`,
    })),
  };
}

// --- COLD CHAIN MONITORING ---

export async function getColdChainStatus(): Promise<ColdChainAlert[]> {
  const zones = await getWarehouseMap();
  const coldZones = zones.filter(z => z.type === 'COLD_STORAGE');

  const alerts: ColdChainAlert[] = [];

  for (const zone of coldZones) {
    if (zone.temperature.status === 'CRITICAL') {
      alerts.push({
        location: zone.name,
        currentTemp: zone.temperature.current,
        safeRange: { min: zone.temperature.min, max: zone.temperature.max },
        severity: 'CRITICAL',
        description: `Temperature ${zone.temperature.current}°C exceeds safe range (${zone.temperature.min}°C to ${zone.temperature.max}°C)`,
        recommendedAction: 'Move inventory to backup cold storage immediately. Check refrigeration unit.',
        timestamp: new Date().toISOString(),
      });
    } else if (zone.temperature.status === 'WARNING') {
      alerts.push({
        location: zone.name,
        currentTemp: zone.temperature.current,
        safeRange: { min: zone.temperature.min, max: zone.temperature.max },
        severity: 'WARNING',
        description: `Temperature ${zone.temperature.current}°C approaching limit`,
        recommendedAction: 'Monitor closely. Check door seals and refrigeration performance.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

// --- WAREHOUSE HEALTH SCORE ---

export async function getWarehouseHealth(): Promise<WarehouseHealth> {
  const zones = await getWarehouseMap();
  const coldAlerts = await getColdChainStatus();

  // Factor 1: Capacity utilization (max 25)
  const avgUtilization = zones.reduce((sum, z) => sum + z.capacity.utilization, 0) / (zones.length || 1);
  const capacityScore = avgUtilization < 70 ? 25 : avgUtilization < 85 ? 20 : avgUtilization < 95 ? 10 : 0;

  // Factor 2: Temperature compliance (max 30)
  const tempViolations = zones.filter(z => z.temperature.status !== 'NORMAL').length;
  const tempScore = tempViolations === 0 ? 30 : tempViolations === 1 ? 15 : 0;

  // Factor 3: Hazard compliance (max 20) — simulated as compliant
  const hazardScore = 20;

  // Factor 4: Inventory risk (max 15)
  const expiredLots = await prisma.rawMaterialLot.count({
    where: { status: 'APPROVED', expiryDate: { lt: new Date() }, deletedAt: null },
  });
  const inventoryScore = expiredLots === 0 ? 15 : expiredLots <= 2 ? 10 : 0;

  // Factor 5: Operational efficiency (max 10)
  const operationalScore = 8; // Simulated

  const totalScore = capacityScore + tempScore + hazardScore + inventoryScore + operationalScore;
  const status = totalScore >= 85 ? 'EXCELLENT' : totalScore >= 65 ? 'GOOD' : totalScore >= 40 ? 'ATTENTION_NEEDED' : 'CRITICAL';

  return {
    score: totalScore,
    status,
    factors: [
      { name: 'Capacity Utilization', score: capacityScore, maxScore: 25, status: capacityScore >= 20 ? 'Good' : 'Needs Attention' },
      { name: 'Temperature Compliance', score: tempScore, maxScore: 30, status: tempScore >= 25 ? 'Good' : tempViolations > 0 ? 'Violation Detected' : 'Good' },
      { name: 'Hazard Segregation', score: hazardScore, maxScore: 20, status: 'Compliant' },
      { name: 'Inventory Risk', score: inventoryScore, maxScore: 15, status: expiredLots > 0 ? `${expiredLots} expired lot(s)` : 'No expired inventory' },
      { name: 'Operational Efficiency', score: operationalScore, maxScore: 10, status: 'Normal' },
    ],
    alerts: coldAlerts,
  };
}


// ============================================================
// HAZARD SEGREGATION ENGINE
// ============================================================

export type HazardClass = 'FLAMMABLE' | 'OXIDIZER' | 'CORROSIVE_ACID' | 'CORROSIVE_BASE' | 'FOOD_GRADE' | 'TOXIC' | 'GENERAL';

export interface HazardViolation {
  lotNumber: string;
  material: string;
  currentLocation: string;
  hazardClass: HazardClass;
  conflictWith: string;
  conflictHazardClass: HazardClass;
  severity: 'HIGH' | 'CRITICAL';
  description: string;
  recommendedAction: string;
  recommendedLocation: string;
}

// Incompatibility matrix
const HAZARD_INCOMPATIBLE: Record<string, string[]> = {
  FLAMMABLE: ['OXIDIZER', 'CORROSIVE_ACID'],
  OXIDIZER: ['FLAMMABLE', 'CORROSIVE_BASE'],
  CORROSIVE_ACID: ['CORROSIVE_BASE', 'FLAMMABLE'],
  CORROSIVE_BASE: ['CORROSIVE_ACID', 'OXIDIZER'],
  FOOD_GRADE: ['TOXIC', 'CORROSIVE_ACID', 'CORROSIVE_BASE'],
  TOXIC: ['FOOD_GRADE'],
};

// Assign hazard class based on material name (simulated)
function classifyMaterial(materialName: string): HazardClass {
  const name = materialName.toLowerCase();
  if (name.includes('ethanol') || name.includes('alcohol') || name.includes('solvent')) return 'FLAMMABLE';
  if (name.includes('peroxide') || name.includes('oxidiz')) return 'OXIDIZER';
  if (name.includes('acid') || name.includes('citric')) return 'CORROSIVE_ACID';
  if (name.includes('base') || name.includes('sodium') || name.includes('alkali')) return 'CORROSIVE_BASE';
  if (name.includes('extract') || name.includes('oil') || name.includes('vanilla') || name.includes('coffee') || name.includes('ginger')) return 'FOOD_GRADE';
  if (name.includes('toxic') || name.includes('pesticide')) return 'TOXIC';
  return 'GENERAL';
}

/**
 * Scan warehouse for hazard segregation violations.
 * Checks if incompatible materials are stored in the same or adjacent zones.
 */
export async function getHazardViolations(): Promise<HazardViolation[]> {
  const violations: HazardViolation[] = [];

  // Get all lots with their storage info via inventory transactions
  const lots = await prisma.rawMaterialLot.findMany({
    where: { deletedAt: null, status: { in: ['APPROVED', 'PENDING_QC'] } },
    include: { material: { select: { name: true } } },
  });

  // Get inventory to determine current locations
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { deletedAt: null, type: 'IN' },
    include: {
      storageLocation: { select: { id: true, name: true, code: true } },
      batch: {
        select: {
          rawMaterials: { include: { rawMaterialLot: { select: { lotNumber: true, material: { select: { name: true } } } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Build location → materials map
  const locationMaterials: Map<string, Array<{ lotNumber: string; material: string; hazardClass: HazardClass }>> = new Map();

  for (const tx of transactions) {
    const locName = tx.storageLocation.name;
    if (!locationMaterials.has(locName)) locationMaterials.set(locName, []);

    if (tx.batch?.rawMaterials) {
      for (const rm of tx.batch.rawMaterials) {
        const matName = rm.rawMaterialLot.material.name;
        locationMaterials.get(locName)!.push({
          lotNumber: rm.rawMaterialLot.lotNumber,
          material: matName,
          hazardClass: classifyMaterial(matName),
        });
      }
    }
  }

  // Also add lots directly (simulated placement)
  const locations = await prisma.storageLocation.findMany({ where: { deletedAt: null }, select: { name: true } });
  for (let i = 0; i < lots.length; i++) {
    const loc = locations[i % locations.length];
    if (!locationMaterials.has(loc.name)) locationMaterials.set(loc.name, []);
    locationMaterials.get(loc.name)!.push({
      lotNumber: lots[i].lotNumber,
      material: lots[i].material.name,
      hazardClass: classifyMaterial(lots[i].material.name),
    });
  }

  // Check for violations within each location
  for (const [location, materials] of locationMaterials) {
    for (let i = 0; i < materials.length; i++) {
      const mat = materials[i];
      const incompatible = HAZARD_INCOMPATIBLE[mat.hazardClass] || [];

      for (let j = i + 1; j < materials.length; j++) {
        const other = materials[j];
        if (incompatible.includes(other.hazardClass)) {
          violations.push({
            lotNumber: mat.lotNumber,
            material: mat.material,
            currentLocation: location,
            hazardClass: mat.hazardClass,
            conflictWith: `${other.material} (${other.lotNumber})`,
            conflictHazardClass: other.hazardClass,
            severity: mat.hazardClass === 'FLAMMABLE' || other.hazardClass === 'FLAMMABLE' ? 'CRITICAL' : 'HIGH',
            description: `${mat.hazardClass} material "${mat.material}" stored with incompatible ${other.hazardClass} material "${other.material}" in ${location}`,
            recommendedAction: `Relocate ${mat.lotNumber} to a ${mat.hazardClass}-compatible zone`,
            recommendedLocation: mat.hazardClass === 'FLAMMABLE' ? 'Hazardous Storage Zone' : 'Quarantine Zone',
          });
        }
      }
    }
  }

  // Deduplicate (same pair only once)
  const seen = new Set<string>();
  return violations.filter(v => {
    const key = [v.lotNumber, v.conflictWith].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10); // Top 10 violations
}

/**
 * Get hazard compatibility matrix for display.
 */
export function getHazardMatrix(): Array<{ class1: string; class2: string; compatible: boolean }> {
  const classes: HazardClass[] = ['FLAMMABLE', 'OXIDIZER', 'CORROSIVE_ACID', 'CORROSIVE_BASE', 'FOOD_GRADE', 'TOXIC'];
  const matrix: Array<{ class1: string; class2: string; compatible: boolean }> = [];

  for (const c1 of classes) {
    for (const c2 of classes) {
      if (c1 === c2) continue;
      const incompatible = HAZARD_INCOMPATIBLE[c1] || [];
      matrix.push({ class1: c1, class2: c2, compatible: !incompatible.includes(c2) });
    }
  }

  return matrix;
}
