import React from 'react';
import { cn, parseRange } from '../lib/utils';
import { translateDNA } from '../lib/translation';

interface Plate96Props {
  data: Record<string, { readCount: number }>;
  variants?: Record<string, any[]>;
  onWellClick: (wellId: string) => void;
  selectedWell: string | null;
  variantFormat: 'format1' | 'format3' | 'format4';
  specificPositions?: string;
  maxDisplayVariants?: number;
  refProtein?: string;
}

const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const cols = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

export function Plate96({ 
  data, 
  variants, 
  onWellClick, 
  selectedWell, 
  variantFormat, 
  specificPositions = '', 
  maxDisplayVariants = 2,
  refProtein = '' 
}: Plate96Props) {
  const maxReads = Math.max(...Object.values(data).map(w => w.readCount), 1);
  const targetPositions = parseRange(specificPositions);

  return (
    <div className="flex flex-col items-center overflow-x-auto w-full">
      <div className="flex flex-col items-start min-w-max">
        <div className="grid grid-cols-[auto_repeat(12,1fr)] gap-1.5 mb-4">
          {/* Top Header */}
          <div className="w-10 h-10"></div>
          {cols.map(col => (
            <div key={col} className="w-10 h-10 flex items-center justify-center font-mono text-sm text-gray-500">
              {col}
            </div>
          ))}

          {/* Rows */}
          {rows.map(row => (
            <React.Fragment key={row}>
              <div className="w-10 h-10 flex items-center justify-center font-mono text-sm text-gray-500">
                {row}
              </div>
              {cols.map(col => {
                const wellId = `${row}${col}`;
                const wellData = data[wellId];
                const readCount = wellData?.readCount || 0;
                const wellVariants = variants?.[wellId] || [];
                
                // Sort variants by sequence position, including synonymous mutations
                const sortedVariants = [...wellVariants].sort((a, b) => a.aaPosition - b.aaPosition);
                
                const allPositions = new Set(sortedVariants.map((v: any) => v.aaPosition));
                targetPositions.forEach((p: number) => allPositions.add(p));

                const combinedMutations = Array.from(allPositions).sort((a: any, b: any) => a - b).map(pos => {
                  const variant = sortedVariants.find((v: any) => v.aaPosition === pos);
                  if (variant) {
                    return { aaPosition: pos, refAA: variant.refAA, altAA: variant.altAA };
                  } else {
                    const aa = refProtein[pos - 1] || '?';
                    return { aaPosition: pos, refAA: aa, altAA: aa };
                  }
                });
                  
                const hasVariants = combinedMutations.length > 0;
                
                // Calculate color intensity based on read count
                const intensity = readCount > 0 ? Math.max(0.2, readCount / maxReads) : 0;
                
                let variantLabel = '';
                let isFail = false;
                
                if (readCount > 0) {
                  if (variantFormat === 'format4') {
                    const outsideMutations = sortedVariants.filter(v => !targetPositions.has(v.aaPosition));
                    if (outsideMutations.length > 0) {
                      variantLabel = 'fail';
                      isFail = true;
                    } else if (targetPositions.size > 0) {
                      const sortedPositions = Array.from(targetPositions).sort((a, b) => a - b);
                      let seq = '';
                      for (const pos of sortedPositions) {
                        const mut = combinedMutations.find(v => v.aaPosition === pos);
                        seq += mut ? mut.altAA : '?';
                      }
                      variantLabel = seq;
                    }
                  } else if (hasVariants) {
                    const displayVariants = combinedMutations.slice(0, maxDisplayVariants);
                    const hasMore = combinedMutations.length > maxDisplayVariants;
                    
                    if (variantFormat === 'format1') {
                      variantLabel = displayVariants.map(v => `${v.refAA}${v.aaPosition}${v.altAA}`).join('\n');
                      if (hasMore) variantLabel += '\n...';
                    } else if (variantFormat === 'format3') {
                      variantLabel = displayVariants.map(v => `${v.aaPosition}${v.altAA}`).join('\n');
                      if (hasMore) variantLabel += '\n...';
                    }
                  }
                }
                
                return (
                  <button
                    key={wellId}
                    onClick={() => onWellClick(wellId)}
                    className={cn(
                      "w-10 h-10 rounded-md border border-gray-200 flex items-center justify-center transition-all relative",
                      "hover:ring-2 hover:ring-indigo-400 hover:scale-110",
                      selectedWell === wellId ? "ring-2 ring-indigo-600 shadow-md" : "",
                      readCount === 0 ? "bg-white" : (isFail ? "bg-rose-100" : "bg-emerald-500")
                    )}
                    style={{
                      backgroundColor: readCount > 0 && !isFail ? `rgba(16, 185, 129, ${intensity})` : undefined
                    }}
                    title={`${wellId}: ${readCount} reads${hasVariants ? ` | ${sortedVariants.length} variants` : ''}`}
                  >
                    {variantLabel && (
                      <span className={cn(
                        "text-[10px] font-bold leading-tight text-center drop-shadow-sm whitespace-pre-wrap z-10",
                        isFail ? "text-rose-600" : "text-stone-900"
                      )}>
                        {variantLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Depth Indicator - Horizontal */}
        <div className="flex flex-col gap-2 mb-6 ml-[46px]" style={{ width: 'calc(100% - 46px)' }}>
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 px-1">
            <span>0</span>
            <span>{Math.round(maxReads * 0.25)}</span>
            <span>{Math.round(maxReads * 0.5)}</span>
            <span>{Math.round(maxReads * 0.75)}</span>
            <span className="font-bold text-emerald-700">{maxReads}</span>
          </div>
          <div className="h-3 w-full bg-stone-100 rounded-full border border-stone-200 shadow-inner overflow-hidden flex">
            <div className="h-full flex-1 bg-gradient-to-r from-emerald-50 to-emerald-600" />
          </div>
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">
            Depth
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border border-gray-200 bg-white" /> Empty
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-500 opacity-50" /> Reads Detected
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-stone-900">M1V</span> Variants Found
        </div>
      </div>
    </div>
  );
}
