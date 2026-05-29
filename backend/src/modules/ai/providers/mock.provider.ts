import { AIProvider, AIAnalysisResult, ManufacturingContext } from '../ai.schema';
import { SupplierContextData } from '../context/supplier.context';
import { QCContextData } from '../context/qc.context';
import { InventoryContextData } from '../context/inventory.context';
import { ProductionContextData } from '../context/production.context';

/**
 * Context-Aware Mock AI Provider.
 * Generates evidence-based responses from real database data.
 * Every answer cites: Supplier, Lot, QC, Production, Inventory.
 * Designed to be replaced with OpenAI/Anthropic/Gemini later.
 */
export class MockAIProvider implements AIProvider {
  async analyze(context: ManufacturingContext): Promise<AIAnalysisResult> {
    switch (context.intent) {
      case 'SUPPLIER_RISK':
        return this.analyzeSupplierRisk(context);
      case 'QC_ANALYSIS':
        return this.analyzeQC(context);
      case 'INVENTORY_RISK':
        return this.analyzeInventoryRisk(context);
      case 'PRODUCTION_ANALYSIS':
        return this.analyzeProduction(context);
      case 'TRACEABILITY':
        return this.analyzeTraceability(context);
      default:
        return this.generalAnalysis(context);
    }
  }

  private analyzeSupplierRisk(ctx: ManufacturingContext): AIAnalysisResult {
    const data = ctx.data.supplier as SupplierContextData;
    const suppliers = data.suppliers;

    if (suppliers.length === 0) {
      return this.emptyResult(ctx, 'Tidak ada data supplier untuk dianalisis.');
    }

    const riskiest = suppliers[0]; // Already sorted by failure rate desc
    const evidence: string[] = [];
    const relatedLots: AIAnalysisResult['relatedEntities']['lots'] = [];
    const relatedSuppliers: AIAnalysisResult['relatedEntities']['suppliers'] = [];

    // Build evidence from real data
    for (const sup of suppliers.slice(0, 3)) {
      relatedSuppliers.push({ id: sup.id, name: sup.name, code: sup.code });
      if (sup.failureRate > 0) {
        evidence.push(`${sup.name}: ${sup.totalLots} lot(s) delivered, ${sup.failedLots} failed QC (failure rate: ${sup.failureRate.toFixed(1)}%)`);
        sup.failedLotNumbers.forEach((ln) => relatedLots.push({ id: '', lotNumber: ln, status: 'FAILED' }));
      } else {
        evidence.push(`${sup.name}: ${sup.totalLots} lot(s) delivered, 0 failures (clean record)`);
      }
    }

    if (riskiest.affectedBatches.length > 0) {
      evidence.push(`Production impact: ${riskiest.affectedBatches.length} batch(es) used materials from ${riskiest.name}`);
    }

    const hasRisk = riskiest.failureRate > 0;
    const riskLevel = riskiest.failureRate > 20 ? 'HIGH' : riskiest.failureRate > 5 ? 'MEDIUM' : 'LOW';

    return {
      summary: hasRisk
        ? `${riskiest.name} is the highest-risk supplier with a ${riskiest.failureRate.toFixed(1)}% QC failure rate (${riskiest.failedLots}/${riskiest.totalLots} lots failed).`
        : `All ${data.totalSuppliers} suppliers have clean QC records. No significant risk detected.`,
      confidence: hasRisk ? 92 : 85,
      riskLevel,
      intent: 'SUPPLIER_RISK',
      evidence,
      recommendations: hasRisk ? [
        `Increase incoming inspection frequency for ${riskiest.name}`,
        `Schedule supplier audit for ${riskiest.name}`,
        riskiest.failureRate > 15 ? `Consider dual-sourcing to reduce dependency on ${riskiest.name}` : `Monitor ${riskiest.name} closely`,
        'Review storage and handling procedures for failed lots',
      ] : [
        'Continue regular supplier monitoring',
        'Maintain current inspection protocols',
        'Schedule annual supplier audits',
      ],
      relatedEntities: {
        suppliers: relatedSuppliers,
        lots: relatedLots,
        productionBatches: riskiest.affectedBatches.map((b) => ({ id: '', lotNumber: b, status: '' })),
        inventory: [],
      },
      supplierAnalysis: {
        supplier: riskiest.name,
        failureRate: riskiest.failureRate,
        totalInspections: riskiest.totalLots,
        failedLots: riskiest.failedLotNumbers,
      },
    };
  }

  private analyzeQC(ctx: ManufacturingContext): AIAnalysisResult {
    const data = ctx.data.qc as QCContextData;
    const evidence: string[] = [];

    // Lot-specific analysis
    if (data.lot) {
      evidence.push(`Lot ${data.lot.lotNumber}: ${data.lot.material} from ${data.lot.supplier}`);
      evidence.push(`Current status: ${data.lot.status}`);
      evidence.push(`Quantity: ${data.lot.quantity} ${data.lot.unit}`);

      if (data.qcHistory.length > 0) {
        data.qcHistory.forEach((qc) => {
          evidence.push(`QC ${qc.type}: ${qc.result} (${new Date(qc.date).toLocaleDateString('id-ID')})${qc.notes ? ` — "${qc.notes}"` : ''}`);
        });
      }

      if (data.supplierHistory) {
        evidence.push(`Supplier ${data.supplierHistory.supplierName}: ${data.supplierHistory.totalLotsFromSupplier} total lots, ${data.supplierHistory.failedLotsFromSupplier} failed (${data.supplierHistory.supplierFailureRate.toFixed(1)}% failure rate)`);
      }
    }

    // System-wide stats
    evidence.push(`System-wide: ${data.totalInspections} total inspections, ${data.totalFailures} failures (${data.overallFailureRate.toFixed(1)}% rate)`);

    if (data.recentFailures.length > 0) {
      evidence.push(`Recent failures:`);
      data.recentFailures.slice(0, 3).forEach((f) => {
        evidence.push(`  - ${f.lotNumber} from ${f.supplier} (${new Date(f.date).toLocaleDateString('id-ID')})${f.notes ? `: ${f.notes}` : ''}`);
      });
    }

    const hasFailed = data.qcHistory.some((qc) => qc.result === 'FAIL');
    const riskLevel = hasFailed ? 'HIGH' : data.overallFailureRate > 10 ? 'MEDIUM' : 'LOW';

    return {
      summary: data.lot
        ? `QC analysis for lot ${data.lot.lotNumber}. ${hasFailed ? `QC FAILED — lot was rejected.` : `Status: ${data.lot.status}.`} Supplier failure rate: ${data.supplierHistory?.supplierFailureRate.toFixed(1) || 0}%.`
        : `System QC overview: ${data.totalFailures} failure(s) out of ${data.totalInspections} inspections (${data.overallFailureRate.toFixed(1)}% failure rate).`,
      confidence: data.lot ? 95 : 80,
      riskLevel,
      intent: 'QC_ANALYSIS',
      evidence,
      rootCauses: hasFailed ? [
        'Raw material quality below specification',
        data.supplierHistory && data.supplierHistory.supplierFailureRate > 10
          ? `Supplier ${data.supplierHistory.supplierName} has elevated failure rate (${data.supplierHistory.supplierFailureRate.toFixed(1)}%)`
          : 'Possible handling or storage issue during transit',
        'Environmental conditions may have affected material integrity',
      ] : undefined,
      recommendations: hasFailed ? [
        'Conduct re-inspection with expanded test parameters',
        'Investigate supplier batch records for this delivery',
        'Check cold chain and storage conditions',
        data.supplierHistory && data.supplierHistory.supplierFailureRate > 10
          ? `Escalate to supplier management — ${data.supplierHistory.supplierName} requires audit`
          : 'Document findings for trend analysis',
      ] : [
        'Continue standard inspection protocols',
        'Monitor failure trends monthly',
        data.overallFailureRate > 5 ? 'Review inspection criteria — failure rate above target' : 'System performing within acceptable parameters',
      ],
      relatedEntities: {
        suppliers: data.supplierHistory ? [{ id: '', name: data.supplierHistory.supplierName, code: '' }] : [],
        lots: data.lot ? [{ id: '', lotNumber: data.lot.lotNumber, status: data.lot.status }] : [],
        productionBatches: [],
        inventory: [],
      },
    };
  }

  private analyzeInventoryRisk(ctx: ManufacturingContext): AIAnalysisResult {
    const data = ctx.data.inventory as InventoryContextData;
    const evidence: string[] = [];

    evidence.push(`Total inventory transactions: ${data.totalTransactions}`);
    evidence.push(`Recent outbound shipments: ${data.recentShipments}`);
    evidence.push(`Storage locations monitored: ${data.locations.length}`);

    if (data.vulnerableInventory.length > 0) {
      evidence.push(`Vulnerable locations identified:`);
      data.vulnerableInventory.forEach((v) => {
        evidence.push(`  - ${v.location}: ${v.reason} (risk score: ${v.riskScore})`);
      });
    }

    data.locations.filter((l) => l.totalMovements > 0).forEach((loc) => {
      evidence.push(`${loc.name}: ${loc.netQuantity} ${loc.unit} net stock, ${loc.totalMovements} movements`);
    });

    const hasVulnerable = data.vulnerableInventory.length > 0;

    return {
      summary: hasVulnerable
        ? `${data.vulnerableInventory.length} vulnerable inventory location(s) identified requiring attention.`
        : `All ${data.locations.length} storage locations operating normally. No immediate risk detected.`,
      confidence: 88,
      riskLevel: hasVulnerable ? 'MEDIUM' : 'LOW',
      intent: 'INVENTORY_RISK',
      evidence,
      recommendations: hasVulnerable ? [
        'Quarantine inventory at vulnerable locations',
        'Conduct physical stock count verification',
        'Review batch traceability for affected items',
        'Update inventory management procedures',
      ] : [
        'Continue regular stock audits',
        'Monitor FIFO compliance',
        'Review expiry date tracking',
      ],
      relatedEntities: {
        suppliers: [],
        lots: [],
        productionBatches: [],
        inventory: data.locations.filter((l) => l.totalMovements > 0).map((l) => ({
          id: l.id, location: l.name, type: 'STOCK', quantity: l.netQuantity,
        })),
      },
    };
  }

  private analyzeProduction(ctx: ManufacturingContext): AIAnalysisResult {
    const data = ctx.data.production as ProductionContextData;
    const evidence: string[] = [];

    evidence.push(`Total production orders: ${data.totalOrders}`);
    evidence.push(`In progress: ${data.inProgressOrders}`);
    evidence.push(`Completed: ${data.completedOrders}`);
    evidence.push(`Blocked: ${data.blockedCount}`);

    if (data.blockedOrders.length > 0) {
      evidence.push(`Blocked orders:`);
      data.blockedOrders.forEach((o) => {
        evidence.push(`  - ${o.orderNumber} (${o.product}): ${o.reason}`);
      });
    }

    if (data.recentBatches.length > 0) {
      evidence.push(`Recent batches:`);
      data.recentBatches.slice(0, 3).forEach((b) => {
        evidence.push(`  - ${b.lotNumber} (${b.status}): ${b.product}, materials: ${b.materialsUsed.join(', ') || 'none'}`);
      });
    }

    const hasBlocked = data.blockedCount > 0;

    return {
      summary: hasBlocked
        ? `${data.blockedCount} production order(s) are currently blocked. ${data.blockedOrders.map((o) => `${o.orderNumber}: ${o.reason}`).join('. ')}.`
        : `Production running smoothly. ${data.inProgressOrders} order(s) in progress, ${data.completedOrders} completed.`,
      confidence: 90,
      riskLevel: hasBlocked ? 'MEDIUM' : 'LOW',
      intent: 'PRODUCTION_ANALYSIS',
      evidence,
      recommendations: hasBlocked ? [
        'Prioritize QC review for pending lots',
        'Expedite incoming raw material deliveries',
        'Consider alternative suppliers for blocked materials',
        'Communicate delays to downstream stakeholders',
      ] : [
        'Monitor batch completion rates',
        'Ensure raw material pipeline is healthy',
        'Review production schedule adherence',
      ],
      relatedEntities: {
        suppliers: [],
        lots: [],
        productionBatches: data.recentBatches.map((b) => ({ id: b.id, lotNumber: b.lotNumber, status: b.status })),
        inventory: [],
      },
    };
  }

  private analyzeTraceability(ctx: ManufacturingContext): AIAnalysisResult {
    const qcData = ctx.data.qc as QCContextData | undefined;
    const lotNumber = (ctx.data.lotNumber as string) || 'Unknown';
    const evidence: string[] = [];

    if (qcData?.lot) {
      evidence.push(`Lot: ${qcData.lot.lotNumber}`);
      evidence.push(`Material: ${qcData.lot.material}`);
      evidence.push(`Supplier: ${qcData.lot.supplier}`);
      evidence.push(`Status: ${qcData.lot.status}`);
      if (qcData.qcHistory.length > 0) {
        evidence.push(`QC inspections: ${qcData.qcHistory.length}`);
        qcData.qcHistory.forEach((qc) => evidence.push(`  - ${qc.type}: ${qc.result}`));
      }
    }

    evidence.push(`Use GET /traceability/${lotNumber} for full forward/backward trace`);
    evidence.push(`Use GET /traceability/recall/${lotNumber} for contamination impact simulation`);

    return {
      summary: qcData?.lot
        ? `Traceability data for ${qcData.lot.lotNumber} (${qcData.lot.material} from ${qcData.lot.supplier}). Status: ${qcData.lot.status}. Use the Recall Simulator for full impact analysis.`
        : `Use the Traceability page or Recall Simulator for detailed lot genealogy.`,
      confidence: qcData?.lot ? 95 : 70,
      riskLevel: 'LOW',
      intent: 'TRACEABILITY',
      evidence,
      recommendations: [
        'Use Recall Simulator for contamination impact analysis',
        'Check Traceability page for full lot genealogy',
        'Forward trace shows where materials went',
        'Backward trace shows where materials came from',
      ],
      relatedEntities: {
        suppliers: qcData?.supplierHistory ? [{ id: '', name: qcData.supplierHistory.supplierName, code: '' }] : [],
        lots: qcData?.lot ? [{ id: '', lotNumber: qcData.lot.lotNumber, status: qcData.lot.status }] : [],
        productionBatches: [],
        inventory: [],
      },
    };
  }

  private generalAnalysis(ctx: ManufacturingContext): AIAnalysisResult {
    const evidence: string[] = [];
    const supplierData = ctx.data.supplier as SupplierContextData | undefined;
    const qcData = ctx.data.qc as QCContextData | undefined;
    const prodData = ctx.data.production as ProductionContextData | undefined;

    if (supplierData) evidence.push(`Suppliers: ${supplierData.totalSuppliers} active`);
    if (qcData) evidence.push(`QC: ${qcData.totalInspections} inspections, ${qcData.totalFailures} failures (${qcData.overallFailureRate.toFixed(1)}%)`);
    if (prodData) evidence.push(`Production: ${prodData.totalOrders} orders, ${prodData.blockedCount} blocked`);

    return {
      summary: `Manufacturing overview based on your question: "${ctx.question}". System has ${supplierData?.totalSuppliers || 0} suppliers, ${qcData?.totalInspections || 0} QC inspections, and ${prodData?.totalOrders || 0} production orders.`,
      confidence: 75,
      riskLevel: 'LOW',
      intent: 'GENERAL',
      evidence,
      recommendations: [
        'Ask specific questions for deeper analysis:',
        '"Why is [supplier name] risky?" — Supplier risk analysis',
        '"Why did [lot number] fail QC?" — QC failure investigation',
        '"Which production orders are blocked?" — Production bottlenecks',
        '"Which inventory is most vulnerable?" — Inventory risk assessment',
      ],
      relatedEntities: { suppliers: [], lots: [], productionBatches: [], inventory: [] },
    };
  }

  private emptyResult(ctx: ManufacturingContext, message: string): AIAnalysisResult {
    return {
      summary: message,
      confidence: 50,
      riskLevel: 'LOW',
      intent: ctx.intent,
      evidence: ['Insufficient data in system for analysis'],
      recommendations: ['Add more data to the system for meaningful analysis'],
      relatedEntities: { suppliers: [], lots: [], productionBatches: [], inventory: [] },
    };
  }
}
