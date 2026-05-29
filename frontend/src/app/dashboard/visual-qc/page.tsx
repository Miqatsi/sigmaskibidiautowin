'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ============================================================
// INTERFACES — Strict TypeScript for API responses
// ============================================================

interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

interface Detection {
  class: string;
  confidence: number;
  box: BoundingBox;
}

/** Response from POST /predict (Raw Material Mode) */
interface PredictResponse {
  success: boolean;
  predictions: Detection[];
  metadata: {
    image_size: { width: number; height: number };
    model: string;
    device: string;
    total_detections: number;
  };
}

/** Response from POST /analyze-powder (Powder Mode) */
interface PowderResponse {
  success: boolean;
  analysis: {
    colour_consistency_score: number;
    status: 'PASS' | 'FAIL';
    contamination_detected: boolean;
    defects: Detection[];
    powder_metrics: {
      channel_variance_score: number;
      spatial_uniformity_score: number;
      outlier_percentage: number;
      hue_std: number;
      saturation_std: number;
      brightness_std: number;
    };
    powder_color: {
      rgb: [number, number, number];
      hex: string;
      mean_hue: number;
      mean_saturation: number;
    };
  };
  metadata: {
    image_size: { width: number; height: number };
    methods: string[];
    device: string;
  };
}

type InspectionMode = 'raw_material' | 'powder';

// ============================================================
// CONSTANTS
// ============================================================

const AI_SERVICE_URL = 'http://localhost:8000';

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function VisualQCInspectorPage() {
  // State
  const [mode, setMode] = useState<InspectionMode>('raw_material');
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [predictResult, setPredictResult] = useState<PredictResponse | null>(null);
  const [powderResult, setPowderResult] = useState<PowderResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // ── File handling ──

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPEG, PNG, WebP).');
      return;
    }
    setFile(selectedFile);
    setImageUrl(URL.createObjectURL(selectedFile));
    setPredictResult(null);
    setPowderResult(null);
    setError('');
    setSaved(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  }, [handleFileSelect]);

  // ── API calls ──

  async function runInspection() {
    if (!file) return;
    setLoading(true);
    setError('');
    setPredictResult(null);
    setPowderResult(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = mode === 'raw_material'
        ? `${AI_SERVICE_URL}/predict`
        : `${AI_SERVICE_URL}/analyze-powder`;

      const response = await fetch(endpoint, { method: 'POST', body: formData });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (mode === 'raw_material') {
        setPredictResult(data as PredictResponse);
      } else {
        setPowderResult(data as PowderResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inspeksi gagal. Pastikan AI service berjalan.');
    } finally {
      setLoading(false);
    }
  }

  async function saveToLotLog() {
    setSaving(true);
    try {
      // Determine result and notes
      let result = 'PASS';
      let notes = '';

      if (mode === 'raw_material' && predictResult) {
        const hasRotten = predictResult.predictions.some(p => p.class.includes('rotten'));
        result = hasRotten ? 'FAIL' : 'PASS';
        notes = `AI Visual QC: ${predictResult.predictions.map(p => `${p.class} (${(p.confidence * 100).toFixed(0)}%)`).join(', ')}`;
      } else if (mode === 'powder' && powderResult) {
        result = powderResult.analysis.status;
        notes = `Powder QC: Score ${powderResult.analysis.colour_consistency_score}%, Contamination: ${powderResult.analysis.contamination_detected ? 'YES' : 'NO'}`;
      }

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/qc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: mode === 'raw_material' ? 'INCOMING' : 'IN_PROCESS',
          result,
          notes,
        }),
      });

      if (response.ok) {
        setSaved(true);
      } else {
        setError('Gagal menyimpan ke QC log. Coba lagi.');
      }
    } catch {
      setError('Gagal terhubung ke backend.');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived state ──

  const hasResult = predictResult !== null || powderResult !== null;
  const overallStatus = (() => {
    if (predictResult) {
      return predictResult.predictions.some(p => p.class.includes('rotten')) ? 'FAIL' : 'PASS';
    }
    if (powderResult) return powderResult.analysis.status;
    return null;
  })();

  const detections: Detection[] = (() => {
    if (predictResult) return predictResult.predictions;
    if (powderResult) return powderResult.analysis.defects;
    return [];
  })();

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔬 Visual QC Inspector</h1>
          <p className="text-base text-gray-600 mt-1">AI-powered quality control inspection</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-600 mb-3">Mode Inspeksi:</p>
        <div className="flex gap-3">
          <button
            onClick={() => { setMode('raw_material'); setPredictResult(null); setPowderResult(null); }}
            className={`flex-1 px-6 py-4 rounded-lg text-lg font-semibold border-2 transition-all ${
              mode === 'raw_material'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            🍊 Raw Material Intake
          </button>
          <button
            onClick={() => { setMode('powder'); setPredictResult(null); setPowderResult(null); }}
            className={`flex-1 px-6 py-4 rounded-lg text-lg font-semibold border-2 transition-all ${
              mode === 'powder'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
            }`}
          >
            🧪 Extract Powder Analysis
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base">{error}</div>
      )}

      {/* Main content: Image + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Upload + Image Preview */}
        <div className="lg:col-span-2 space-y-4">

          {/* Upload zone */}
          {!imageUrl && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="text-5xl mb-4">📷</div>
              <p className="text-xl font-semibold text-gray-700">
                Drag & drop gambar di sini
              </p>
              <p className="text-base text-gray-500 mt-2">
                atau klik untuk memilih file (JPEG, PNG, WebP)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Image preview with bounding box overlay */}
          {imageUrl && (
            <div className="relative bg-gray-900 rounded-xl overflow-hidden">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="QC Sample"
                className="w-full h-auto max-h-[500px] object-contain"
              />

              {/* Bounding box overlay */}
              {detections.length > 0 && imageRef.current && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {detections.map((det, i) => {
                    const isContamination = det.class.includes('rotten') || det.class === 'contamination';
                    const color = isContamination ? '#ef4444' : '#22c55e';
                    return (
                      <g key={i}>
                        <rect
                          x={det.box.x_min}
                          y={det.box.y_min}
                          width={det.box.x_max - det.box.x_min}
                          height={det.box.y_max - det.box.y_min}
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                        />
                        <rect
                          x={det.box.x_min}
                          y={det.box.y_min - 28}
                          width={Math.max(120, det.class.length * 10)}
                          height="28"
                          fill={color}
                          rx="4"
                        />
                        <text
                          x={det.box.x_min + 6}
                          y={det.box.y_min - 8}
                          fill="white"
                          fontSize="14"
                          fontWeight="bold"
                        >
                          {det.class} {(det.confidence * 100).toFixed(0)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Controls below image */}
              <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => { setImageUrl(null); setFile(null); setPredictResult(null); setPowderResult(null); setSaved(false); }}
                >
                  🔄 Ganti Gambar
                </Button>
                <Button
                  size="lg"
                  onClick={runInspection}
                  loading={loading}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Menganalisis...' : '🔍 Jalankan Inspeksi AI'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results Panel */}
        <div className="space-y-4">

          {/* Status Badge */}
          {overallStatus && (
            <div className={`rounded-xl p-6 text-center ${
              overallStatus === 'PASS'
                ? 'bg-green-50 border-2 border-green-500'
                : 'bg-red-50 border-2 border-red-500 animate-pulse'
            }`}>
              <div className={`text-5xl font-black ${
                overallStatus === 'PASS' ? 'text-green-600' : 'text-red-600'
              }`}>
                {overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}
              </div>
              <p className={`text-lg mt-2 font-medium ${
                overallStatus === 'PASS' ? 'text-green-700' : 'text-red-700'
              }`}>
                {overallStatus === 'PASS'
                  ? 'Material memenuhi standar QC'
                  : 'Material TIDAK memenuhi standar'}
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <Card>
              <div className="flex flex-col items-center py-8">
                <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-700">AI sedang menganalisis...</p>
                <p className="text-sm text-gray-500 mt-1">
                  {mode === 'raw_material' ? 'Deteksi defek dengan YOLO' : 'Analisis warna & kontaminasi'}
                </p>
              </div>
            </Card>
          )}

          {/* Raw Material Results */}
          {predictResult && (
            <Card title="Hasil Deteksi">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total deteksi:</span>
                  <span className="text-xl font-bold">{predictResult.metadata.total_detections}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Model:</span>
                  <span className="font-mono text-sm">{predictResult.metadata.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Device:</span>
                  <Badge variant="info">{predictResult.metadata.device}</Badge>
                </div>

                {predictResult.predictions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold text-gray-700">Deteksi:</p>
                    {predictResult.predictions.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant={p.class.includes('rotten') ? 'danger' : 'success'}>
                            {p.class}
                          </Badge>
                        </div>
                        <span className="font-mono font-bold">{(p.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {predictResult.predictions.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Tidak ada objek terdeteksi.</p>
                )}
              </div>
            </Card>
          )}

          {/* Powder Results */}
          {powderResult && (
            <Card title="Analisis Powder">
              <div className="space-y-4">
                {/* Colour Consistency Gauge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 font-medium">Konsistensi Warna:</span>
                    <span className="text-2xl font-black">
                      {powderResult.analysis.colour_consistency_score}%
                    </span>
                  </div>
                  <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        powderResult.analysis.colour_consistency_score >= 85
                          ? 'bg-green-500'
                          : powderResult.analysis.colour_consistency_score >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${powderResult.analysis.colour_consistency_score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Threshold: 85% untuk PASS</p>
                </div>

                {/* Contamination */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-700">Kontaminasi:</span>
                  <Badge variant={powderResult.analysis.contamination_detected ? 'danger' : 'success'}>
                    {powderResult.analysis.contamination_detected ? '⚠️ TERDETEKSI' : '✅ BERSIH'}
                  </Badge>
                </div>

                {/* Powder colour swatch */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-300"
                    style={{ backgroundColor: powderResult.analysis.powder_color.hex }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Warna Dominan</p>
                    <p className="text-xs font-mono text-gray-500">{powderResult.analysis.powder_color.hex}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Hue σ</p>
                    <p className="font-bold">{powderResult.analysis.powder_metrics.hue_std}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Sat σ</p>
                    <p className="font-bold">{powderResult.analysis.powder_metrics.saturation_std}</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Spatial</p>
                    <p className="font-bold">{powderResult.analysis.powder_metrics.spatial_uniformity_score}%</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <p className="text-gray-500">Outlier</p>
                    <p className="font-bold">{powderResult.analysis.powder_metrics.outlier_percentage}%</p>
                  </div>
                </div>

                {/* Defects */}
                {powderResult.analysis.defects.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-700">Defek Terdeteksi:</p>
                    {powderResult.analysis.defects.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <Badge variant="danger">{d.class}</Badge>
                        <span className="font-mono text-sm">{(d.confidence * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Save button */}
          {hasResult && (
            <div className="space-y-2">
              {saved ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-green-700 font-semibold text-lg">✅ Tersimpan ke QC Log</p>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  variant={overallStatus === 'PASS' ? 'primary' : 'danger'}
                  onClick={saveToLotLog}
                  loading={saving}
                  disabled={saving}
                >
                  💾 Simpan Inspeksi ke Lot Log
                </Button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasResult && !loading && (
            <Card>
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-3">🔬</p>
                <p className="text-lg font-medium">Belum ada hasil</p>
                <p className="text-sm mt-1">Upload gambar dan jalankan inspeksi AI</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
