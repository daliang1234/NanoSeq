export const FORWARD_BARCODES: Record<string, string> = {
  '1': 'CACAAAGACACCGACAACTTTCTT',
  '2': 'ACAGACGACTACAAACGGAATCGA',
  '3': 'CCTGGTAACTGGGACACAAGACTC',
  '4': 'AGAACGACTTCCATACTCGTGTGA',
  '5': 'AACGAGTCTCTTGGGACCCATAGA',
  '6': 'GACTACTTTCTGCCTTTGCGAGAA',
  '7': 'AAGGATTCATTCCCACGGTAACAC',
  '8': 'ACGTAACTTGGTTTGTTCCCTGAA',
  '9': 'AACCAAGACTCGCTGTGCCTAGTT',
  '10': 'GAGAGGACAAAGGTTTCAACGCTT',
  '11': 'TCCATTCCCTCCGATAGATGAAAC',
  '12': 'CGTCAACTGACAGTGGTTCGTACT'
};

export const REVERSE_BARCODES: Record<string, string> = {
  'A': 'AAGAAAGTTGTCGGTGTCTTTGTG',
  'B': 'TCGATTCCGTTTGTAGTCGTCTGT',
  'C': 'GAGTCTTGTGTCCCAGTTACCAGG',
  'D': 'AACTAGGCACAGCGAGTCTTGGTT',
  'E': 'CTTGTCCAGGGTTTGTGTAACCTT',
  'F': 'TTCTCGCAAAGGCAGAAAGTAGTC',
  'G': 'GTGTTACCGTGGGAATGAATCCTT',
  'H': 'TTCAGGGAACAAACCAAGTTACGT'
};

export function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'N': 'N', 'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'n': 'n' };
  return seq.split('').reverse().map(c => comp[c] || c).join('');
}

// Semi-global alignment to find minimum distance of barcode within sequence
export function getMinDistance(sequence: string, barcode: string): number {
  if (sequence.length < barcode.length) return Infinity;
  
  let prevRow = new Array(sequence.length + 1).fill(0);
  let currRow = new Array(sequence.length + 1).fill(0);

  for (let i = 1; i <= barcode.length; i++) {
    currRow[0] = i; // Deletion cost in barcode
    for (let j = 1; j <= sequence.length; j++) {
      const cost = barcode[i - 1] === sequence[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,      // insertion in sequence
        prevRow[j] + 1,          // deletion in sequence
        prevRow[j - 1] + cost    // substitution
      );
    }
    let temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  let min = Infinity;
  for (let j = 0; j <= sequence.length; j++) {
    if (prevRow[j] < min) min = prevRow[j];
  }
  return min;
}
