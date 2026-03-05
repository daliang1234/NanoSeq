import { reverseComplement, getMinDistance } from '../lib/barcodes';
import { alignAndCallVariants } from '../lib/alignment';

self.onmessage = async (e: MessageEvent) => {
  const { file, reference, forwardBarcodes, reverseBarcodes, maxErrors = 4 } = e.data;
  
  if (!file) return;

  try {
    const text = await file.text();
    const lines = text.split('\n');
    
    const reads: string[] = [];
    for (let i = 1; i < lines.length; i += 4) {
      if (lines[i]) {
        reads.push(lines[i].trim().toUpperCase());
      }
    }

    const demuxed: Record<string, string[]> = {};
    const searchWindow = 100;

    let processed = 0;
    const total = reads.length;

    for (const read of reads) {
      if (read.length < searchWindow * 2) continue;

      const startSeq = read.substring(0, searchWindow);
      const endSeq = read.substring(read.length - searchWindow);

      let bestFwdCol: string | null = null;
      let minFwdDist = Infinity;
      for (const [col, bc] of Object.entries(forwardBarcodes as Record<string, string>)) {
        const dist = getMinDistance(startSeq, bc);
        if (dist < minFwdDist) { minFwdDist = dist; bestFwdCol = col; }
      }

      let bestRevRow: string | null = null;
      let minRevDist = Infinity;
      for (const [row, bc] of Object.entries(reverseBarcodes as Record<string, string>)) {
        const rcBc = reverseComplement(bc);
        const dist = getMinDistance(endSeq, rcBc);
        if (dist < minRevDist) { minRevDist = dist; bestRevRow = row; }
      }

      // Check reverse strand
      let bestFwdCol_rev: string | null = null;
      let minFwdDist_rev = Infinity;
      for (const [col, bc] of Object.entries(forwardBarcodes as Record<string, string>)) {
        const rcBc = reverseComplement(bc);
        const dist = getMinDistance(endSeq, rcBc);
        if (dist < minFwdDist_rev) { minFwdDist_rev = dist; bestFwdCol_rev = col; }
      }

      let bestRevRow_rev: string | null = null;
      let minRevDist_rev = Infinity;
      for (const [row, bc] of Object.entries(reverseBarcodes as Record<string, string>)) {
        const dist = getMinDistance(startSeq, bc);
        if (dist < minRevDist_rev) { minRevDist_rev = dist; bestRevRow_rev = row; }
      }

      let finalRow: string | null = null;
      let finalCol: string | null = null;
      let isRev = false;

      const fwdScore = minFwdDist + minRevDist;
      const revScore = minFwdDist_rev + minRevDist_rev;

      if (fwdScore < revScore && minFwdDist <= maxErrors && minRevDist <= maxErrors) {
        finalRow = bestRevRow;
        finalCol = bestFwdCol;
        isRev = false;
      } else if (revScore <= fwdScore && minFwdDist_rev <= maxErrors && minRevDist_rev <= maxErrors) {
        finalRow = bestRevRow_rev;
        finalCol = bestFwdCol_rev;
        isRev = true;
      }

      if (finalRow && finalCol) {
        const wellId = `${finalRow}${finalCol}`;
        if (!demuxed[wellId]) demuxed[wellId] = [];
        // Store the forward read
        demuxed[wellId].push(isRev ? reverseComplement(read) : read);
      }

      processed++;
      if (processed % 100 === 0) {
        self.postMessage({ type: 'progress', progress: (processed / total) * 100 });
      }
    }

    self.postMessage({ type: 'progress', progress: 100 });
    
    // Now call variants
    const variants: Record<string, any[]> = {};
    const wellStats: Record<string, { readCount: number }> = {};
    
    for (const [wellId, wellReads] of Object.entries(demuxed)) {
      wellStats[wellId] = { readCount: wellReads.length };
      if (reference) {
        variants[wellId] = alignAndCallVariants(wellReads, reference);
      }
    }

    self.postMessage({ type: 'complete', demuxed, variants, wellStats });

  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
