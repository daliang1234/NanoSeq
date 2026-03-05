import React, { useState, useRef } from 'react';
import { Settings2, Save, X, Upload, AlertCircle } from 'lucide-react';

interface BarcodeEditorProps {
  forwardBarcodes: Record<string, string>;
  reverseBarcodes: Record<string, string>;
  onSave: (fwd: Record<string, string>, rev: Record<string, string>) => void;
}

export function BarcodeEditor({ forwardBarcodes, reverseBarcodes, onSave }: BarcodeEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fwd, setFwd] = useState(forwardBarcodes);
  const [rev, setRev] = useState(reverseBarcodes);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(fwd, rev);
    setIsOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const newFwd = { ...fwd };
      const newRev = { ...rev };
      let updated = false;
      let parseError = null;

      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;

        // Support formats:
        // 1. ID, Sequence (e.g., 1, ATGC... or A, ATGC...)
        // 2. Type, ID, Sequence (e.g., Forward, 1, ATGC...)
        
        let type, id, seq;
        if (parts.length >= 3) {
          [type, id, seq] = parts;
        } else {
          [id, seq] = parts;
          // Heuristic: if ID is a number, it's likely Forward; if it's a letter A-H, it's likely Reverse
          if (/^[1-9][0-9]*$/.test(id)) type = 'forward';
          else if (/^[A-H]$/i.test(id)) type = 'reverse';
          else continue;
        }

        const cleanType = type.toLowerCase();
        const cleanId = id.toUpperCase();
        const cleanSeq = seq.toUpperCase().replace(/[^ACGT]/g, '');

        if (cleanType.includes('fwd') || cleanType.includes('forward')) {
          if (newFwd[cleanId] !== undefined) {
            newFwd[cleanId] = cleanSeq;
            updated = true;
          }
        } else if (cleanType.includes('rev') || cleanType.includes('reverse')) {
          if (newRev[cleanId] !== undefined) {
            newRev[cleanId] = cleanSeq;
            updated = true;
          }
        }
      }

      if (updated) {
        setFwd(newFwd);
        setRev(newRev);
        setError(null);
      } else {
        setError('No valid barcodes found in CSV. Use format: ID,Sequence (e.g., 1,ATGC or A,ATGC)');
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:text-indigo-600 bg-stone-100 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        <Settings2 className="w-4 h-4" />
        Edit Barcodes
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-600" />
              Barcode Configuration
            </h2>
            <p className="text-xs text-stone-500 mt-1">Configure barcodes for demultiplexing</p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Forward Barcodes */}
          <div>
            <h3 className="font-medium text-stone-900 mb-4">Forward Barcodes (Columns 1-12)</h3>
            <div className="space-y-3">
              {Object.entries(fwd).map(([key, value]) => (
                <div key={`fwd-${key}`} className="flex items-center gap-3">
                  <label className="w-8 text-sm font-medium text-stone-500">{key}-F</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setFwd({ ...fwd, [key]: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-1.5 font-mono text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Reverse Barcodes */}
          <div>
            <h3 className="font-medium text-stone-900 mb-4">Reverse Barcodes (Rows A-H)</h3>
            <p className="text-xs text-stone-500 mb-4">Note: These should be entered in 5'-3' orientation. The app will automatically reverse-complement them during analysis.</p>
            <div className="space-y-3">
              {Object.entries(rev).map(([key, value]) => (
                <div key={`rev-${key}`} className="flex items-center gap-3">
                  <label className="w-8 text-sm font-medium text-stone-500">{key}-R</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setRev({ ...rev, [key]: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-1.5 font-mono text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-stone-200 flex justify-end gap-3 bg-stone-50 rounded-b-2xl">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
