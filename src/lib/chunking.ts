/**
 * Document Chunking Utility for Legal Documents
 * Preserves legal citations, section references, and judges' names using a specialized sentence splitter.
 */

/**
 * Splits text into sentences while avoiding splitting on abbreviations common in legal documents.
 */
export function splitIntoSentences(text: string): string[] {
  // Regex explanation:
  // Splits on [.!?] followed by whitespace, EXCEPT:
  // - single uppercase/lowercase initials (e.g., A. B. Shah)
  // - versus abbreviations (v., vs.)
  // - standard legal abbreviations (supp., art., arts., sec., secs., no., nos., vol., ltd., co., corp., inc.)
  // - months (jan., feb., etc.)
  const sentenceBoundaryRegex = /(?<!\b(?:[a-zA-Z]|vs?|supp|art|secs?|nos?|vol|ltd|co|corp|inc|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.)(?<=[.?!])\s+/i;
  
  return text.split(sentenceBoundaryRegex).map(s => s.trim()).filter(Boolean);
}

/**
 * Chunks a document into segments of a specified size with a configured overlap.
 * 
 * @param text The document text to chunk
 * @param chunkSize Target size of each chunk in characters (default: 1000)
 * @param chunkOverlap Overlap between consecutive chunks in characters (default: 200)
 * @returns Array of text chunks
 */
export function chunkDocument(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): string[] {
  if (!text || text.trim() === '') {
    return [];
  }

  // If text is shorter than target chunk size, return it as a single chunk
  if (text.length <= chunkSize) {
    return [text.trim()];
  }

  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  
  let currentChunkSentences: string[] = [];
  let currentChunkLength = 0;

  for (const sentence of sentences) {
    // If a single sentence exceeds the chunk size, we must split it by words to avoid losing data
    if (sentence.length > chunkSize) {
      // First, flush whatever is in the current chunk
      if (currentChunkSentences.length > 0) {
        chunks.push(currentChunkSentences.join(' '));
        currentChunkSentences = [];
        currentChunkLength = 0;
      }

      // Split long sentence by word boundaries
      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordChunkLength = 0;

      for (const word of words) {
        if (wordChunkLength + word.length + 1 > chunkSize) {
          chunks.push(wordChunk.join(' '));
          // Start next word chunk with overlap
          const overlapWords: string[] = [];
          let overlapLength = 0;
          for (let i = wordChunk.length - 1; i >= 0; i--) {
            if (overlapLength + wordChunk[i].length + 1 <= chunkOverlap) {
              overlapWords.unshift(wordChunk[i]);
              overlapLength += wordChunk[i].length + 1;
            } else {
              break;
            }
          }
          wordChunk = [...overlapWords, word];
          wordChunkLength = overlapLength + word.length + 1;
        } else {
          wordChunk.push(word);
          wordChunkLength += word.length + 1;
        }
      }
      if (wordChunk.length > 0) {
        currentChunkSentences = wordChunk;
        currentChunkLength = wordChunkLength;
      }
      continue;
    }

    // Standard sentence accumulator
    if (currentChunkLength + sentence.length + (currentChunkSentences.length > 0 ? 1 : 0) > chunkSize) {
      // Save current chunk
      chunks.push(currentChunkSentences.join(' '));

      // Calculate overlap sentences
      const overlapSentences: string[] = [];
      let overlapLength = 0;

      for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
        const s = currentChunkSentences[i];
        if (overlapLength + s.length + (overlapSentences.length > 0 ? 1 : 0) <= chunkOverlap) {
          overlapSentences.unshift(s);
          overlapLength += s.length + (overlapSentences.length > 0 ? 1 : 0);
        } else {
          break;
        }
      }

      currentChunkSentences = [...overlapSentences, sentence];
      currentChunkLength = overlapLength + sentence.length + (overlapSentences.length > 0 ? 1 : 0);
    } else {
      currentChunkSentences.push(sentence);
      currentChunkLength += sentence.length + (currentChunkSentences.length > 1 ? 1 : 0);
    }
  }

  // Push the final chunk if anything remains
  if (currentChunkSentences.length > 0) {
    chunks.push(currentChunkSentences.join(' '));
  }

  return chunks;
}
