import { AIProvider, AIAnalysisResult } from '../ai.schema';

/**
 * Mock AI Provider — generates intelligent responses based on context parsing.
 * No external API calls. Designed to be replaced with OpenAI/Anthropic later.
 */
export class MockAIProvider implements AIProvider {
  async analyze(context: string, question: string): Promise<AIAnalysisResult> {
    const lowerQ = question.toLowerCase();

    // Detect question intent
    if (lowerQ.includes('fail') || lowerQ.includes('gagal') || lowerQ.includes('reject')) {
      return this.analyzeFailure(context, question);
    }

    if (lowerQ.includes('affected') || lowerQ.includes('contaminated') || lowerQ.includes('terdampak') || lowerQ.includes('recall')) {
      return this.analyzeImpact(context, question);
    }

    if (lowerQ.includes('supplier') && (lowerQ.includes('rate') || lowerQ.includes('worst') || lowerQ.includes('best') || lowerQ.includes('tertinggi'))) {
      return this.analyzeSupplierRisk(context, question);
    }

    if (lowerQ.includes('trace') || lowerQ.includes('lacak') || lowerQ.includes('history') || lowerQ.includes('riwayat')) {
      return this.analyzeTraceability(context, question);
    }

    // Default: general manufacturing insight
    return this.generalAnalysis(context, question);
  }

  private analyzeFailure(context: string, question: string): AIAnalysisResult {
    const lotMatch = question.match(/[A-Z]{2,}-[\w-]+/i);
    const lotNumber = lotMatch ? lotMatch[0] : 'Unknown';

    // Parse context for QC failures
    const failedQC = context.includes('FAIL');
    const supplier = this.extractField(context, 'supplier');

    return {
      summary: `Analisis kegagalan QC untuk lot ${lotNumber}. ${failedQC ? 'Ditemukan record QC FAIL dalam sistem.' : 'Tidak ditemukan record kegagalan eksplisit.'}`,
      rootCauses: [
        'Kemungkinan kontaminasi dari bahan baku supplier',
        'Parameter penyimpanan tidak sesuai (suhu/kelembaban)',
        'Proses handling yang tidak sesuai SOP',
        supplier ? `Perlu investigasi supplier: ${supplier}` : 'Supplier perlu diverifikasi',
      ],
      recommendations: [
        'Lakukan re-inspeksi dengan parameter yang lebih ketat',
        'Periksa batch lain dari supplier yang sama',
        'Review cold chain log selama transportasi',
        'Pertimbangkan audit supplier jika failure rate > 5%',
      ],
      riskLevel: failedQC ? 'HIGH' : 'MEDIUM',
      affectedLots: lotNumber !== 'Unknown' ? [lotNumber] : [],
    };
  }

  private analyzeImpact(context: string, question: string): AIAnalysisResult {
    const lotMatch = question.match(/[A-Z]{2,}-[\w-]+/i);
    const lotNumber = lotMatch ? lotMatch[0] : 'Unknown';

    // Parse context for production batches
    const batchMatches = context.match(/FG-[\w-]+/g) || [];
    const hasInventory = context.includes('inventory');

    return {
      summary: `Impact analysis untuk lot ${lotNumber}. ${batchMatches.length > 0 ? `Ditemukan ${batchMatches.length} batch terkait.` : 'Tidak ada batch produksi yang menggunakan lot ini.'}`,
      riskLevel: batchMatches.length > 0 ? 'HIGH' : 'LOW',
      affectedLots: [lotNumber],
      affectedBatches: batchMatches,
      recommendations: [
        batchMatches.length > 0 ? 'SEGERA: Hold semua batch yang menggunakan lot ini' : 'Lot belum masuk produksi — aman untuk di-quarantine',
        'Notifikasi tim QC untuk re-inspeksi',
        hasInventory ? 'Cek inventory — produk mungkin sudah di-dispatch' : 'Belum ada movement inventory',
        'Siapkan dokumentasi untuk regulatory compliance',
      ],
    };
  }

  private analyzeSupplierRisk(context: string, question: string): AIAnalysisResult {
    // Parse supplier stats from context
    const supplierData = this.parseSupplierStats(context);

    return {
      summary: `Analisis risiko supplier berdasarkan data QC. ${supplierData.length > 0 ? `${supplierData.length} supplier teranalisis.` : 'Data supplier belum cukup untuk analisis.'}`,
      supplierAnalysis: supplierData.length > 0
        ? supplierData.sort((a, b) => b.failureRate - a.failureRate)[0]
        : { supplier: 'Belum ada data', failureRate: 0, totalInspections: 0 },
      recommendations: [
        'Review supplier dengan failure rate > 5%',
        'Pertimbangkan dual-sourcing untuk material kritis',
        'Jadwalkan audit supplier tahunan',
        'Implementasi incoming inspection yang lebih ketat untuk supplier berisiko',
      ],
      riskLevel: 'MEDIUM',
    };
  }

  private analyzeTraceability(context: string, question: string): AIAnalysisResult {
    const lotMatch = question.match(/[A-Z]{2,}-[\w-]+/i);
    const lotNumber = lotMatch ? lotMatch[0] : 'Unknown';

    return {
      summary: `Traceability report untuk ${lotNumber}. Gunakan endpoint GET /traceability/${lotNumber} untuk data lengkap.`,
      recommendations: [
        'Gunakan fitur Traceability di dashboard untuk visualisasi lengkap',
        'Forward trace: lihat kemana lot ini digunakan',
        'Backward trace: lihat asal-usul bahan baku',
      ],
      riskLevel: 'LOW',
      affectedLots: lotNumber !== 'Unknown' ? [lotNumber] : [],
    };
  }

  private generalAnalysis(context: string, question: string): AIAnalysisResult {
    return {
      summary: `Analisis manufacturing berdasarkan pertanyaan: "${question}". Sistem telah mengumpulkan konteks dari database (lots, QC, production, inventory).`,
      recommendations: [
        'Untuk analisis spesifik, sebutkan nomor lot atau nama supplier',
        'Contoh: "Why did lot RM-001 fail QC?"',
        'Contoh: "Which supplier has highest failure rate?"',
        'Contoh: "What is affected if RM-001 is contaminated?"',
      ],
      riskLevel: 'LOW',
    };
  }

  private extractField(context: string, field: string): string | null {
    const regex = new RegExp(`${field}[:\\s]+"?([^"\\n,]+)"?`, 'i');
    const match = context.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseSupplierStats(context: string): Array<{ supplier: string; failureRate: number; totalInspections: number }> {
    // Parse from structured context
    const supplierSection = context.match(/SUPPLIER_STATS:([\s\S]*?)(?:END_STATS|$)/);
    if (!supplierSection) return [];

    const lines = supplierSection[1].split('\n').filter(l => l.trim());
    return lines.map(line => {
      const parts = line.split('|');
      return {
        supplier: parts[0]?.trim() || 'Unknown',
        failureRate: parseFloat(parts[1]) || 0,
        totalInspections: parseInt(parts[2]) || 0,
      };
    }).filter(s => s.supplier !== 'Unknown');
  }
}
