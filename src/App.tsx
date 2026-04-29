import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Play, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { Plate96 } from './components/Plate96';
import { BarcodeEditor } from './components/BarcodeEditor';
import { cn } from './lib/utils';
import { FORWARD_BARCODES, REVERSE_BARCODES } from './lib/barcodes';
import { translateDNA } from './lib/translation';
import { parseRange } from './lib/utils';
import ProcessWorker from './workers/process.worker?worker';

export default function App() {
  const [reference, setReference] = useState('');
  const [fastqFile, setFastqFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [selectedWell, setSelectedWell] = useState<string | null>(null);
  const [variantFormat, setVariantFormat] = useState<'format1' | 'format3' | 'format4'>('format1');
  const [specificPositions, setSpecificPositions] = useState('305-309');
  const [maxDisplayVariants, setMaxDisplayVariants] = useState(2);
  
  const [forwardBarcodes, setForwardBarcodes] = useState(FORWARD_BARCODES);
  const [reverseBarcodes, setReverseBarcodes] = useState(REVERSE_BARCODES);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new ProcessWorker();
    workerRef.current.onmessage = (e) => {
      const { type, progress, error, demuxed, variants, wellStats } = e.data;
      if (type === 'progress') {
        setProgress(progress);
      } else if (type === 'error') {
        setError(error);
        setProcessing(false);
      } else if (type === 'complete') {
        setResults({ demuxed, variants, wellStats });
        setProcessing(false);
        setProgress(100);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleStart = () => {
    if (!fastqFile) {
      setError('Please upload a FASTQ file.');
      return;
    }
    if (!reference) {
      setError('Please provide a reference sequence.');
      return;
    }
    setError(null);
    setProcessing(true);
    setProgress(0);
    setResults(null);
    setSelectedWell(null);

    workerRef.current?.postMessage({
      file: fastqFile,
      reference: reference.trim().toUpperCase(),
      forwardBarcodes,
      reverseBarcodes
    });
  };

  const handleDownloadFastq = (wellId: string) => {
    if (!results || !results.demuxed[wellId]) return;
    const reads = results.demuxed[wellId];
    // Create a simple FASTQ format
    const content = reads.map((read: string, i: number) => `@${wellId}_read_${i + 1}\n${read}\n+\n${'I'.repeat(read.length)}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wellId}.fastq`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVariantsCSV = () => {
    if (!results || !results.variants) return;

    let csvContent = "Well,Variants\n";
    const refProtein = translateDNA(reference);
    const targetPosSet = parseRange(specificPositions);
    
    // Sort wells properly (A1, A2... A12, B1...)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cols = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
    
    for (const row of rows) {
      for (const col of cols) {
        const wellId = `${row}${col}`;
        const wellVariants = results.variants[wellId] || [];
        
        // Filter for non-synonymous mutations and sort by sequence position
        const nonSynonymous = wellVariants
          .filter((v: any) => v.refAA !== v.altAA)
          .sort((a: any, b: any) => a.aaPosition - b.aaPosition);
        
        let variantLabel = '';
        if (variantFormat === 'format4') {
          const hasOutsideMutation = nonSynonymous.some((v: any) => !targetPosSet.has(v.aaPosition));
          if (hasOutsideMutation) {
            variantLabel = 'fail';
          } else {
            const sortedTargetPos = Array.from(targetPosSet).sort((a, b) => a - b);
            variantLabel = sortedTargetPos.map(pos => {
              const variant = nonSynonymous.find((v: any) => v.aaPosition === pos);
              if (variant) return variant.altAA;
              return refProtein[pos - 1] || '?';
            }).join('');
          }
        } else if (nonSynonymous.length > 0) {
          if (variantFormat === 'format1') {
            variantLabel = nonSynonymous.map((v: any) => `${v.refAA}${v.aaPosition}${v.altAA}`).join('/');
          } else if (variantFormat === 'format3') {
            variantLabel = nonSynonymous.map((v: any) => `${v.aaPosition}${v.altAA}`).join('/');
          }
        }
        
        const readCount = results.wellStats[wellId]?.readCount || 0;
        if (readCount === 0) {
          csvContent += `${wellId},empty\n`;
        } else {
          csvContent += `${wellId},${variantLabel || 'WT'}\n`;
        }
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variants_summary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            N
          </div>
          <h1 className="text-xl font-semibold tracking-tight">NanoSeq Demux & Variant Caller</h1>
        </div>
        <div className="flex items-center gap-4">
          <BarcodeEditor 
            forwardBarcodes={forwardBarcodes} 
            reverseBarcodes={reverseBarcodes} 
            onSave={(fwd, rev) => {
              setForwardBarcodes(fwd);
              setReverseBarcodes(rev);
            }}
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar - Inputs */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              1. Reference Sequence
            </h2>
            <textarea
              className="w-full h-32 p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm resize-none"
              placeholder="Paste your reference sequence here (A, C, G, T)..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              2. FASTQ File
            </h2>
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:bg-stone-50 transition-colors">
              <input
                type="file"
                accept=".fastq,.fq"
                className="hidden"
                id="fastq-upload"
                onChange={(e) => setFastqFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="fastq-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-stone-400 mb-2" />
                <span className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  {fastqFile ? fastqFile.name : 'Click to upload FASTQ file'}
                </span>
                <span className="text-xs text-stone-500 mt-1">
                  Nanopore sequencing reads
                </span>
              </label>
            </div>
          </section>

          <button
            onClick={handleStart}
            disabled={processing || !fastqFile || !reference}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
              processing || !fastqFile || !reference
                ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow"
            )}
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing... {Math.round(progress)}%
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Analysis
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          
          {results && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Analysis Complete</p>
                <p className="opacity-90 mt-1">
                  Demultiplexed {Object.values(results.demuxed).reduce((acc: any, val: any) => acc + val.length, 0)} reads into {Object.keys(results.demuxed).length} wells.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Content - Results */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">3. Plate Overview</h2>
              {results && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={variantFormat}
                      onChange={(e) => setVariantFormat(e.target.value as any)}
                      className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-stone-700 font-medium"
                    >
                      <option value="format1">Format: A2L</option>
                      <option value="format3">Format: 2L</option>
                      <option value="format4">Format: Specific Pos</option>
                    </select>
                    {(variantFormat === 'format1' || variantFormat === 'format3') && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Max:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={maxDisplayVariants}
                          onChange={(e) => setMaxDisplayVariants(parseInt(e.target.value) || 1)}
                          className="text-sm border border-stone-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none w-14"
                          title="Maximum number of variants to display in well"
                        />
                      </div>
                    )}
                    {variantFormat === 'format4' && (
                      <input
                        type="text"
                        value={specificPositions}
                        onChange={(e) => setSpecificPositions(e.target.value)}
                        placeholder="e.g. 305-309"
                        className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none w-32"
                        title="Enter positions or ranges, e.g. 305-309, 312"
                      />
                    )}
                  </div>
                  <button
                    onClick={handleDownloadVariantsCSV}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Variants CSV
                  </button>
                </div>
              )}
            </div>
            {results ? (
              <Plate96
                data={results.wellStats}
                variants={results.variants}
                onWellClick={setSelectedWell}
                selectedWell={selectedWell}
                variantFormat={variantFormat}
                specificPositions={specificPositions}
                maxDisplayVariants={maxDisplayVariants}
                refProtein={translateDNA(reference)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-400">
                <div className="w-16 h-16 border-4 border-dashed border-stone-200 rounded-full mb-4 flex items-center justify-center">
                  <div className="w-8 h-8 bg-stone-100 rounded-full" />
                </div>
                <p>Run analysis to view plate results</p>
              </div>
            )}
          </section>

          {selectedWell && results && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  Well {selectedWell} Details
                  <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 text-xs font-mono">
                    {results.demuxed[selectedWell]?.length || 0} reads
                  </span>
                </h2>
                {results.demuxed[selectedWell]?.length > 0 && (
                  <button
                    onClick={() => handleDownloadFastq(selectedWell)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    FASTQ
                  </button>
                )}
              </div>

              {results.variants[selectedWell] && results.variants[selectedWell].length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-y border-stone-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">AA Position</th>
                        <th className="px-4 py-3 font-medium">Codon Change</th>
                        <th className="px-4 py-3 font-medium">AA Change</th>
                        <th className="px-4 py-3 font-medium">Depth</th>
                        <th className="px-4 py-3 font-medium">Frequency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {results.variants[selectedWell].map((v: any, i: number) => (
                        <tr key={i} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-mono text-stone-600">{v.aaPosition}</td>
                          <td className="px-4 py-3 font-mono text-stone-600">
                            <span className="text-stone-400">{v.refCodon}</span>
                            <span className="mx-2 text-stone-300">→</span>
                            <span className="text-rose-600 font-medium">{v.altCodon}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-stone-600">
                            <span className={v.refAA !== v.altAA ? "text-rose-600 font-medium" : "text-emerald-600"}>
                              {v.refAA}{v.aaPosition}{v.altAA}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-stone-600">{v.depth}</td>
                          <td className="px-4 py-3 text-stone-600">{(v.frequency * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500 text-sm">
                  {results.demuxed[selectedWell]?.length > 0 
                    ? "No variants found compared to reference."
                    : "No reads detected in this well."}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

