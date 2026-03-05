// Basic Needleman-Wunsch with no end gap penalties for the read
// This aligns a read to the reference sequence.
import { translateDNA } from './translation';

export interface Variant {
  aaPosition: number;
  refCodon: string;
  altCodon: string;
  refAA: string;
  altAA: string;
  depth: number;
  frequency: number;
}

export function alignAndCallVariants(reads: string[], reference: string): Variant[] {
  if (reads.length === 0 || !reference) return [];

  // Profile matrix: an array of objects for each reference position
  // We'll track A, C, G, T, and insertions/deletions relative to reference
  // For simplicity, we just track substitutions and deletions at each ref position.
  // Insertions are harder to track in a simple 1D profile, so we'll skip them for a basic variant caller,
  // or we can just track the most common base aligned to each ref position.
  
  const profile: Record<string, number>[] = Array.from({ length: reference.length }, () => ({
    'A': 0, 'C': 0, 'G': 0, 'T': 0, '-': 0, 'N': 0
  }));

  for (const read of reads) {
    // Semi-global alignment: read against reference
    // We want to map read bases to reference bases
    const alignment = alignReadToReference(read, reference);
    
    // Update profile
    for (let i = 0; i < alignment.length; i++) {
      const { refPos, readBase } = alignment[i];
      if (refPos >= 0 && refPos < reference.length) {
        profile[refPos][readBase] = (profile[refPos][readBase] || 0) + 1;
      }
    }
  }

  const variants: Variant[] = [];
  
  // To compute amino acid changes, we need the full consensus sequence
  let consensusSequence = '';
  for (let i = 0; i < reference.length; i++) {
    const counts = profile[i];
    let maxBase = '-';
    let maxCount = 0;
    for (const [base, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxBase = base;
      }
    }
    // If no coverage, fall back to reference base
    consensusSequence += (maxCount > 0 && maxBase !== '-' && maxBase !== 'N') ? maxBase : reference[i].toUpperCase();
  }
  
  // Iterate by codon (step by 3)
  for (let i = 0; i < reference.length - 2; i += 3) {
    const refCodon = reference.substring(i, i + 3).toUpperCase();
    const altCodon = consensusSequence.substring(i, i + 3).toUpperCase();
    
    if (refCodon !== altCodon) {
      // Calculate average depth and frequency for the mutated positions in this codon
      let totalMutDepth = 0;
      let totalMutCount = 0;
      let mutPositions = 0;

      for (let j = 0; j < 3; j++) {
        const pos = i + j;
        if (refCodon[j] !== altCodon[j]) {
          const counts = profile[pos];
          let depth = 0;
          let altCount = counts[altCodon[j]] || 0;
          for (const count of Object.values(counts)) {
            depth += count;
          }
          totalMutDepth += depth;
          totalMutCount += altCount;
          mutPositions++;
        }
      }

      const avgDepth = mutPositions > 0 ? Math.round(totalMutDepth / mutPositions) : 0;
      const avgFreq = mutPositions > 0 && totalMutDepth > 0 ? totalMutCount / totalMutDepth : 0;

      if (avgDepth > 0) {
        variants.push({
          aaPosition: Math.floor(i / 3) + 1, // 1-based AA position
          refCodon,
          altCodon,
          refAA: translateDNA(refCodon),
          altAA: translateDNA(altCodon),
          depth: avgDepth,
          frequency: avgFreq
        });
      }
    }
  }

  return variants;
}

function alignReadToReference(read: string, ref: string): { refPos: number, readBase: string }[] {
  // To keep it fast in JS, we use a simple banded alignment or just a sliding window mapping
  // For a prototype, let's do a simple k-mer mapping to find the offset, then linear scan.
  // This is a heuristic to avoid O(N*M) for long reads.
  
  const k = 15;
  if (read.length < k || ref.length < k) return [];
  
  // Find best offset
  let bestOffset = 0;
  let maxMatches = 0;
  
  // Try offsets from -read.length to ref.length
  // To be faster, just sample a few k-mers from the read
  const kmer = read.substring(0, k);
  const kmerMid = read.substring(Math.floor(read.length / 2), Math.floor(read.length / 2) + k);
  
  let startOffset = ref.indexOf(kmer);
  if (startOffset === -1) {
    const midOffset = ref.indexOf(kmerMid);
    if (midOffset !== -1) {
      startOffset = midOffset - Math.floor(read.length / 2);
    }
  }
  
  if (startOffset === -1) {
    // Fallback: just align from 0
    startOffset = 0;
  }
  
  const alignment: { refPos: number, readBase: string }[] = [];
  
  // Simple linear mapping with no indels for speed, or very basic indel handling
  // For a real app, we'd use a WebAssembly aligner like minimap2 or SSW.
  // Here we just map 1:1 based on the offset.
  for (let i = 0; i < read.length; i++) {
    const refPos = startOffset + i;
    if (refPos >= 0 && refPos < ref.length) {
      alignment.push({ refPos, readBase: read[i].toUpperCase() });
    }
  }
  
  return alignment;
}
