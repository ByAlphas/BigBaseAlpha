/**
 * Full-Text Search Engine for BigBaseAlpha
 * Provides text search, indexing, and relevance scoring
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export class SearchEngine {
  constructor(config = {}) {
    // Logger setup (fallback to default if not provided)
    this.logger = config.logger || {
      info: (...args) => console.log('[INFO] [SEARCH]', ...args),
      warn: (...args) => console.warn('[WARN] [SEARCH]', ...args),
      error: (...args) => console.error('[ERROR] [SEARCH]', ...args),
      success: (...args) => console.log('[SUCCESS] [SEARCH]', ...args),
      debug: (...args) => console.log('[DEBUG] [SEARCH]', ...args)
    };
    
    this.config = {
      path: config.path || './search_indexes',
      minWordLength: config.minWordLength || 2,
      maxWordLength: config.maxWordLength || 50,
      stemming: config.stemming !== false,
      stopWords: config.stopWords || this._getDefaultStopWords(),
      fuzzyThreshold: config.fuzzyThreshold || 0.7,
      ...config
    };
    
    this.indexes = new Map(); // collection -> field -> word -> documents
    this.documentFields = new Map(); // collection -> docId -> extracted text
    this.isInitialized = false;
  }

  async init() {
    try {
      // Create search indexes directory
      if (!existsSync(this.config.path)) {
        mkdirSync(this.config.path, { recursive: true });
      }

      // Load existing indexes
      await this._loadIndexes();
      
      this.isInitialized = true;
      this.logger.success('Search Engine initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Search Engine: ${error.message}`);
    }
  }

  /**
   * Index a document for full-text search
   */
  async indexDocument(collectionName, document, searchableFields = null) {
    if (!this.isInitialized) {
      throw new Error('Search Engine not initialized');
    }

    const docId = document._id;
    if (!docId) {
      throw new Error('Document must have an _id field');
    }

    // Determine which fields to index
    const fieldsToIndex = searchableFields || this._getTextFields(document);
    
    // Extract and process text from specified fields
    const extractedText = this._extractText(document, fieldsToIndex);
    
    // Store document field data
    if (!this.documentFields.has(collectionName)) {
      this.documentFields.set(collectionName, new Map());
    }
    this.documentFields.get(collectionName).set(docId, {
      text: extractedText,
      fields: fieldsToIndex,
      indexed: new Date()
    });

    // Process each field separately for targeted search
    for (const field of fieldsToIndex) {
      if (document[field]) {
        await this._indexField(collectionName, field, docId, document[field]);
      }
    }

    // Save indexes to disk
    await this._saveIndexes(collectionName);
  }

  /**
   * Remove a document from search indexes
   */
  async removeDocument(collectionName, docId) {
    if (!this.isInitialized) return;

    // Remove from document fields
    if (this.documentFields.has(collectionName)) {
      this.documentFields.get(collectionName).delete(docId);
    }

    // Remove from word indexes
    if (this.indexes.has(collectionName)) {
      const collectionIndex = this.indexes.get(collectionName);
      for (const [field, fieldIndex] of collectionIndex) {
        for (const [word, docs] of fieldIndex) {
          if (docs.has(docId)) {
            docs.delete(docId);
            // Remove empty word entries
            if (docs.size === 0) {
              fieldIndex.delete(word);
            }
          }
        }
      }
    }

    await this._saveIndexes(collectionName);
  }

  /**
   * Search for documents using full-text search
   */
  async search(collectionName, query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Search Engine not initialized');
    }

    const {
      fields = null, // Specific fields to search, null = all indexed fields
      fuzzy = false,
      limit = 50,
      offset = 0,
      highlight = false,
      minScore = 0.1
    } = options;

    // Parse and process search query
    const searchTerms = this._parseQuery(query);
    if (searchTerms.length === 0) {
      return [];
    }

    // Get search results with relevance scores
    const results = await this._executeSearch(collectionName, searchTerms, {
      fields,
      fuzzy,
      minScore
    });

    // Sort by relevance score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    // Add highlights if requested
    if (highlight) {
      for (const result of paginatedResults) {
        result.highlights = await this._generateHighlights(
          collectionName, 
          result.docId, 
          searchTerms
        );
      }
    }

    return paginatedResults;
  }

  /**
   * Get search suggestions/autocomplete
   */
  async suggest(collectionName, partial, options = {}) {
    const { limit = 10, field = null } = options;
    
    if (!this.indexes.has(collectionName)) {
      return [];
    }

    const suggestions = new Set();
    const collectionIndex = this.indexes.get(collectionName);
    const searchFields = field ? [field] : Array.from(collectionIndex.keys());

    for (const fieldName of searchFields) {
      if (collectionIndex.has(fieldName)) {
        const fieldIndex = collectionIndex.get(fieldName);
        
        for (const word of fieldIndex.keys()) {
          if (word.startsWith(partial.toLowerCase())) {
            suggestions.add(word);
            if (suggestions.size >= limit) break;
          }
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get search statistics
   */
  getStats(collectionName = null) {
    if (collectionName) {
      return this._getCollectionStats(collectionName);
    }

    // Overall stats
    let totalWords = 0;
    let totalDocuments = 0;
    const collections = [];

    for (const [collection] of this.indexes) {
      const stats = this._getCollectionStats(collection);
      collections.push({ collection, ...stats });
      totalWords += stats.uniqueWords;
      totalDocuments += stats.documentsIndexed;
    }

    return {
      totalWords,
      totalDocuments,
      collectionsIndexed: this.indexes.size,
      collections
    };
  }

  // Private methods
  async _indexField(collectionName, fieldName, docId, text) {
    const words = this._processText(text);
    
    // Initialize nested maps if needed
    if (!this.indexes.has(collectionName)) {
      this.indexes.set(collectionName, new Map());
    }
    const collectionIndex = this.indexes.get(collectionName);
    
    if (!collectionIndex.has(fieldName)) {
      collectionIndex.set(fieldName, new Map());
    }
    const fieldIndex = collectionIndex.get(fieldName);

    // Index each word
    for (const word of words) {
      if (!fieldIndex.has(word)) {
        fieldIndex.set(word, new Map());
      }
      
      const wordDocs = fieldIndex.get(word);
      if (!wordDocs.has(docId)) {
        wordDocs.set(docId, 0);
      }
      wordDocs.set(docId, wordDocs.get(docId) + 1); // Term frequency
    }
  }

  _processText(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }

    // Convert to lowercase and extract words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length >= this.config.minWordLength && 
        word.length <= this.config.maxWordLength &&
        !this.config.stopWords.includes(word)
      );

    // Apply stemming if enabled
    if (this.config.stemming) {
      return words.map(word => this._stem(word));
    }

    return words;
  }

  _parseQuery(query) {
    // Handle quoted phrases
    const phrases = [];
    const quotedPhrases = query.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      for (const phrase of quotedPhrases) {
        phrases.push(phrase.slice(1, -1)); // Remove quotes
        query = query.replace(phrase, '');
      }
    }

    // Process remaining words
    const words = this._processText(query);
    
    return [...phrases, ...words];
  }

  async _executeSearch(collectionName, searchTerms, options) {
    if (!this.indexes.has(collectionName)) {
      return [];
    }

    const collectionIndex = this.indexes.get(collectionName);
    const searchFields = options.fields || Array.from(collectionIndex.keys());
    const documentScores = new Map();

    // Search each term across specified fields
    for (const term of searchTerms) {
      for (const field of searchFields) {
        if (!collectionIndex.has(field)) continue;
        
        const fieldIndex = collectionIndex.get(field);
        const matches = this._findMatches(fieldIndex, term, options.fuzzy);

        for (const [docId, termFreq] of matches) {
          if (!documentScores.has(docId)) {
            documentScores.set(docId, {
              docId,
              score: 0,
              matches: new Set()
            });
          }

          const docScore = documentScores.get(docId);
          
          // Calculate TF-IDF-like score
          const tf = termFreq;
          const totalDocs = this.documentFields.get(collectionName)?.size || 1;
          const docsWithTerm = matches.size;
          const idf = Math.log(totalDocs / (docsWithTerm + 1));
          
          docScore.score += tf * idf;
          docScore.matches.add(term);
        }
      }
    }

    // Filter by minimum score and convert to array
    return Array.from(documentScores.values())
      .filter(doc => doc.score >= options.minScore)
      .map(doc => ({
        ...doc,
        matches: Array.from(doc.matches)
      }));
  }

  _findMatches(fieldIndex, term, fuzzy = false) {
    const matches = new Map();

    if (fieldIndex.has(term)) {
      // Exact match
      for (const [docId, freq] of fieldIndex.get(term)) {
        matches.set(docId, freq);
      }
    } else if (fuzzy) {
      // Fuzzy matching
      for (const [word, docs] of fieldIndex) {
        if (this._similarity(term, word) >= this.config.fuzzyThreshold) {
          for (const [docId, freq] of docs) {
            matches.set(docId, (matches.get(docId) || 0) + freq * 0.7); // Penalty for fuzzy match
          }
        }
      }
    }

    return matches;
  }

  _similarity(str1, str2) {
    // Simple Levenshtein distance similarity
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  async _generateHighlights(collectionName, docId, searchTerms) {
    const docData = this.documentFields.get(collectionName)?.get(docId);
    if (!docData) return {};

    const highlights = {};
    
    for (const field of docData.fields) {
      const text = docData.text[field] || '';
      let highlightedText = text;
      
      // Highlight each search term
      for (const term of searchTerms) {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        highlightedText = highlightedText.replace(
          regex, 
          `<mark>$&</mark>`
        );
      }
      
      highlights[field] = highlightedText;
    }

    return highlights;
  }

  _extractText(document, fields) {
    const extracted = {};
    
    for (const field of fields) {
      if (document[field]) {
        extracted[field] = String(document[field]);
      }
    }
    
    return extracted;
  }

  _getTextFields(document) {
    // Auto-detect text fields
    const textFields = [];
    
    for (const [key, value] of Object.entries(document)) {
      if (key.startsWith('_')) continue; // Skip metadata fields
      
      if (typeof value === 'string' && value.length > 0) {
        textFields.push(key);
      }
    }
    
    return textFields;
  }

  _getCollectionStats(collectionName) {
    const collectionIndex = this.indexes.get(collectionName);
    const documentsData = this.documentFields.get(collectionName);
    
    if (!collectionIndex || !documentsData) {
      return {
        uniqueWords: 0,
        documentsIndexed: 0,
        fieldsIndexed: []
      };
    }

    let uniqueWords = 0;
    const fieldsIndexed = [];

    for (const [field, fieldIndex] of collectionIndex) {
      fieldsIndexed.push(field);
      uniqueWords += fieldIndex.size;
    }

    return {
      uniqueWords,
      documentsIndexed: documentsData.size,
      fieldsIndexed
    };
  }

  _stem(word) {
    // Simple English stemming (Porter Stemmer subset)
    // Remove common suffixes
    const suffixes = [
      'ing', 'ly', 'ed', 'ies', 'ied', 'ies', 'ied', 'ies', 'ied',
      's', 'es'
    ];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    return word;
  }

  _getDefaultStopWords() {
    return [
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if'
    ];
  }

  async _loadIndexes() {
    try {
      const indexPath = join(this.config.path, 'search_indexes.json');
      if (existsSync(indexPath)) {
        const data = await fs.readFile(indexPath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Reconstruct Maps from serialized data
        for (const [collection, fields] of Object.entries(parsed.indexes || {})) {
          const collectionMap = new Map();
          for (const [field, words] of Object.entries(fields)) {
            const fieldMap = new Map();
            for (const [word, docs] of Object.entries(words)) {
              fieldMap.set(word, new Map(Object.entries(docs)));
            }
            collectionMap.set(field, fieldMap);
          }
          this.indexes.set(collection, collectionMap);
        }

        // Reconstruct document fields
        for (const [collection, docs] of Object.entries(parsed.documentFields || {})) {
          this.documentFields.set(collection, new Map(Object.entries(docs)));
        }
      }
    } catch (error) {
      console.warn('Could not load search indexes:', error.message);
    }
  }

  async _saveIndexes(collectionName = null) {
    try {
      // Convert Maps to serializable objects
      const serializable = {
        indexes: {},
        documentFields: {},
        lastUpdated: new Date().toISOString()
      };

      for (const [collection, fields] of this.indexes) {
        if (collectionName && collection !== collectionName) continue;
        
        serializable.indexes[collection] = {};
        for (const [field, words] of fields) {
          serializable.indexes[collection][field] = {};
          for (const [word, docs] of words) {
            serializable.indexes[collection][field][word] = Object.fromEntries(docs);
          }
        }
      }

      for (const [collection, docs] of this.documentFields) {
        if (collectionName && collection !== collectionName) continue;
        serializable.documentFields[collection] = Object.fromEntries(docs);
      }

      const indexPath = join(this.config.path, 'search_indexes.json');
      await fs.writeFile(indexPath, JSON.stringify(serializable, null, 2));
    } catch (error) {
      console.error('Failed to save search indexes:', error);
    }
  }

  async close() {
    if (this.isInitialized) {
      await this._saveIndexes();
      this.isInitialized = false;
    }
  }
}
