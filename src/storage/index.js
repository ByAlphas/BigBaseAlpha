/*
 * Copyright 2025 BigBaseAlpha Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { promises as fs, existsSync, createReadStream, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';

/**
 * Storage Engine for BigBaseAlpha
 * Handles file-based storage with multiple format support
 */
export class StorageEngine {
  constructor(config) {
    this.config = config;
    this.basePath = config.path;
    this.format = config.format || 'json';
    this.compression = config.compression || false;
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      totalBytes: 0
    };
  }

  async init() {
    // Ensure collections directory exists
    const collectionsPath = join(this.basePath, 'collections');
    if (!existsSync(collectionsPath)) {
      await fs.mkdir(collectionsPath, { recursive: true });
    }

    // Ensure metadata directory exists
    const metadataPath = join(this.basePath, 'metadata');
    if (!existsSync(metadataPath)) {
      await fs.mkdir(metadataPath, { recursive: true });
    }

    // Initialize format-specific settings
    await this._initFormat();
  }

  async createCollection(name) {
    const collectionPath = this._getCollectionPath(name);
    if (!existsSync(collectionPath)) {
      await fs.mkdir(collectionPath, { recursive: true });
    }

    // Create metadata file
    const metadata = {
      name,
      created: new Date(),
      format: this.format,
      compression: this.compression,
      documentCount: 0
    };

    await this._writeMetadata(name, metadata);
  }

  async insert(collectionName, document) {
    const filePath = this._getDocumentPath(collectionName, document._id);
    const data = await this._serializeDocument(document);
    
    await this._ensureDirectory(dirname(filePath));
    await this._writeFile(filePath, data);
    
    // Update collection metadata
    await this._updateCollectionMetadata(collectionName, { documentCount: '+1' });
    
    this.stats.totalWrites++;
    return document;
  }

  async findById(collectionName, id) {
    const filePath = this._getDocumentPath(collectionName, id);
    
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = await this._readFile(filePath);
      const document = await this._deserializeDocument(data);
      this.stats.totalReads++;
      return document;
    } catch (error) {
      console.error(`Error reading document ${id}:`, error);
      return null;
    }
  }

  async update(collectionName, id, document) {
    const filePath = this._getDocumentPath(collectionName, id);
    const data = await this._serializeDocument(document);
    
    await this._writeFile(filePath, data);
    this.stats.totalWrites++;
    return document;
  }

  async delete(collectionName, id) {
    const filePath = this._getDocumentPath(collectionName, id);
    
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
      
      // Update collection metadata
      await this._updateCollectionMetadata(collectionName, { documentCount: '-1' });
      return true;
    }
    
    return false;
  }

  async listCollections() {
    const collectionsPath = join(this.basePath, 'collections');
    
    if (!existsSync(collectionsPath)) {
      return [];
    }

    const entries = await fs.readdir(collectionsPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  }

  async listDocuments(collectionName, limit = null, offset = 0) {
    const collectionPath = this._getCollectionPath(collectionName);
    
    if (!existsSync(collectionPath)) {
      return [];
    }

    const files = await fs.readdir(collectionPath);
    const documentFiles = files.filter(file => this._isDocumentFile(file));
    
    // Apply pagination
    let paginatedFiles = documentFiles.slice(offset);
    if (limit !== null) {
      paginatedFiles = paginatedFiles.slice(0, limit);
    }

    const documents = [];
    for (const file of paginatedFiles) {
      const filePath = join(collectionPath, file);
      try {
        const data = await this._readFile(filePath);
        const document = await this._deserializeDocument(data);
        documents.push(document);
      } catch (error) {
        console.error(`Error reading document from ${file}:`, error);
      }
    }

    this.stats.totalReads += documents.length;
    return documents;
  }

  async backup(backupPath) {
    const backupDir = dirname(backupPath);
    await this._ensureDirectory(backupDir);

    // Create backup metadata
    const backupMetadata = {
      timestamp: new Date(),
      source: this.basePath,
      format: this.format,
      compression: this.compression,
      collections: await this.listCollections()
    };

    // If using single file backup
    if (backupPath.endsWith('.bba')) {
      await this._createArchiveBackup(backupPath, backupMetadata);
    } else {
      // Directory backup
      await this._createDirectoryBackup(backupPath, backupMetadata);
    }

    return backupPath;
  }

  async restore(backupPath) {
    if (backupPath.endsWith('.bba')) {
      await this._restoreFromArchive(backupPath);
    } else {
      await this._restoreFromDirectory(backupPath);
    }
  }

  getStats() {
    return { ...this.stats };
  }

  async dropCollection(name) {
    const collectionPath = this._getCollectionPath(name);
    const metadataPath = this._getMetadataPath(name);
    
    // Remove collection directory
    if (existsSync(collectionPath)) {
      await fs.rm(collectionPath, { recursive: true, force: true });
    }
    
    // Remove metadata file
    if (existsSync(metadataPath)) {
      await fs.unlink(metadataPath);
    }
  }

  async getCollectionStats(name) {
    const collectionPath = this._getCollectionPath(name);
    const metadataPath = this._getMetadataPath(name);
    
    if (!existsSync(collectionPath)) {
      return null;
    }
    
    let totalSize = 0;
    let fileCount = 0;
    
    try {
      const files = await fs.readdir(collectionPath);
      
      for (const file of files) {
        if (this._isDocumentFile(file)) {
          const filePath = join(collectionPath, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        }
      }
      
      // Add metadata file size
      if (existsSync(metadataPath)) {
        const metaStats = await fs.stat(metadataPath);
        totalSize += metaStats.size;
      }
      
      return {
        name,
        documents: fileCount,
        size: totalSize,
        path: collectionPath
      };
    } catch (error) {
      return null;
    }
  }

  async close() {
    // Cleanup any open resources
    this.stats = {
      totalReads: 0,
      totalWrites: 0,
      totalBytes: 0
    };
  }

  // Private methods

  async _initFormat() {
    switch (this.format) {
      case 'json':
      case 'binary':
      case 'hybrid':
      case 'csv':
      case 'xml':
      case 'yaml':
      case 'db':
        // No special initialization needed for these formats
        break;
      default:
        throw new Error(`Unsupported storage format: ${this.format}`);
    }
  }

  _getCollectionPath(collectionName) {
    return join(this.basePath, 'collections', collectionName);
  }

  _getDocumentPath(collectionName, id) {
    const extension = this._getFileExtension();
    return join(this._getCollectionPath(collectionName), `${id}${extension}`);
  }

  _getMetadataPath(collectionName) {
    return join(this.basePath, 'metadata', `${collectionName}.meta.json`);
  }

  _getFileExtension() {
    switch (this.format) {
      case 'json':
        return this.compression ? '.json.gz' : '.json';
      case 'binary':
        return this.compression ? '.bba.gz' : '.bba';
      case 'hybrid':
        return this.compression ? '.hyb.gz' : '.hyb';
      case 'csv':
        return this.compression ? '.csv.gz' : '.csv';
      case 'xml':
        return this.compression ? '.xml.gz' : '.xml';
      case 'yaml':
        return this.compression ? '.yaml.gz' : '.yaml';
      case 'db':
        return this.compression ? '.db.gz' : '.db';
      default:
        return '.data';
    }
  }

  _isDocumentFile(filename) {
    const extensions = ['.json', '.bba', '.hyb', '.csv', '.xml', '.yaml', '.db', '.data'];
    return extensions.some(ext => 
      filename.endsWith(ext) || filename.endsWith(`${ext}.gz`)
    );
  }

  async _serializeDocument(document) {
    switch (this.format) {
      case 'json':
        return JSON.stringify(document, null, 2);
      case 'binary':
        return this._serializeBinary(document);
      case 'hybrid':
        return this._serializeHybrid(document);
      case 'csv':
        return this._serializeCSV(document);
      case 'xml':
        return this._serializeXML(document);
      case 'yaml':
        return this._serializeYAML(document);
      case 'db':
        return this._serializeDB(document);
      default:
        throw new Error(`Unsupported format: ${this.format}`);
    }
  }

  async _deserializeDocument(data) {
    switch (this.format) {
      case 'json':
        return JSON.parse(data);
      case 'binary':
        return this._deserializeBinary(data);
      case 'hybrid':
        return this._deserializeHybrid(data);
      case 'csv':
        return this._deserializeCSV(data);
      case 'xml':
        return this._deserializeXML(data);
      case 'yaml':
        return this._deserializeYAML(data);
      case 'db':
        return this._deserializeDB(data);
      default:
        throw new Error(`Unsupported format: ${this.format}`);
    }
  }

  // --- CSV ---
  _serializeCSV(document) {
    // Flatten nested objects/arrays as JSON strings
    const flatten = obj => {
      const flat = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null) {
          flat[k] = JSON.stringify(v);
        } else {
          flat[k] = v;
        }
      }
      return flat;
    };
    let arr = Array.isArray(document) ? document : [document];
    arr = arr.map(flatten);
    const keys = Array.from(new Set(arr.flatMap(obj => Object.keys(obj))));
    const header = keys.join(',');
    const rows = arr.map(row => keys.map(k => row[k] !== undefined ? JSON.stringify(row[k]) : '""').join(','));
    return [header, ...rows].join('\n');
  }

  _deserializeCSV(data) {
    const [header, ...rows] = data.toString().split(/\r?\n/);
    const keys = header.split(',');
    return rows.filter(Boolean).map(row => {
      const values = row.split(',').map(v => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
      return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    });
  }

  // --- XML ---
  _serializeXML(document) {
    const toXML = (obj, nodeName = 'root') => {
      if (Array.isArray(obj)) {
        return obj.map(item => toXML(item, nodeName)).join('');
      } else if (typeof obj === 'object' && obj !== null) {
        return `<${nodeName}>` + Object.entries(obj).map(([k, v]) => toXML(v, k)).join('') + `</${nodeName}>`;
      } else {
        return `<${nodeName}>${String(obj)}</${nodeName}>`;
      }
    };
    return toXML(document);
  }

  _deserializeXML(data) {
    // Simple XML to object (not robust, for demo)
    const parseTag = str => {
      const tagMatch = str.match(/^<([^>]+)>([\s\S]*)<\/\1>$/);
      if (!tagMatch) return str;
      const [, tag, content] = tagMatch;
      if (content.match(/^<[^>]+>/)) {
        // Nested
        const children = [];
        let rest = content;
        while (rest.length) {
          const childMatch = rest.match(/^(<[^>]+>[\s\S]*?<\/[^>]+>)([\s\S]*)$/);
          if (!childMatch) break;
          children.push(parseTag(childMatch[1]));
          rest = childMatch[2];
        }
        return { [tag]: children };
      } else {
        return { [tag]: content };
      }
    };
    return parseTag(data.toString());
  }

  // --- YAML ---
  _serializeYAML(document) {
    // Simple YAML (no dependencies)
    const toYAML = (obj, indent = 0) => {
      if (Array.isArray(obj)) {
        return obj.map(item => '- ' + toYAML(item, indent + 2)).join('\n');
      } else if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).map(([k, v]) => ' '.repeat(indent) + k + ': ' + toYAML(v, indent + 2)).join('\n');
      } else {
        return String(obj);
      }
    };
    return toYAML(document);
  }

  _deserializeYAML(data) {
    // Simple YAML to object (not robust, for demo)
    const lines = data.toString().split(/\r?\n/);
    const obj = {};
    for (const line of lines) {
      if (!line.trim()) continue;
      const [k, ...rest] = line.split(':');
      obj[k.trim()] = rest.join(':').trim();
    }
    return obj;
  }

  // --- DB (custom binary) ---
  _serializeDB(document) {
    // Add warning message at the top of the file
    const warning = Buffer.from('THIS FILE CANNOT BE VIEWED DIRECTLY. IT IS MANAGED BY BIGBASEALPHA.\n');
    const header = Buffer.from('BBA_DB1');
    const json = JSON.stringify(document);
    const body = Buffer.from(json, 'utf8');
    // File = [warning][header][body]
    return Buffer.concat([warning, header, body]);
  }

  _deserializeDB(data) {
    // Skip warning message (find first newline) and then check header
    const newlineIdx = data.indexOf(0x0A); // '\n'
    if (newlineIdx === -1) throw new Error('Corrupted .db file: missing warning');
    const header = data.slice(newlineIdx + 1, newlineIdx + 8).toString();
    if (header !== 'BBA_DB1') throw new Error('Invalid .db file');
    const json = data.slice(newlineIdx + 8).toString('utf8');
    return JSON.parse(json);
  }

  _serializeBinary(document) {
    // Simple binary serialization
    const jsonString = JSON.stringify(document);
    const buffer = Buffer.from(jsonString, 'utf8');
    
    // Add checksum
    const checksum = createHash('sha256').update(buffer).digest();
    return Buffer.concat([checksum, buffer]);
  }

  _deserializeBinary(data) {
    // Extract checksum and data
    const checksum = data.slice(0, 32);
    const content = data.slice(32);
    
    // Verify checksum
    const expectedChecksum = createHash('sha256').update(content).digest();
    if (!checksum.equals(expectedChecksum)) {
      throw new Error('Data corruption detected: checksum mismatch');
    }
    
    const jsonString = content.toString('utf8');
    return JSON.parse(jsonString);
  }

  _serializeHybrid(document) {
    // Hybrid format: JSON for metadata, binary for large fields
    const metadata = {};
    const binaryFields = {};
    
    for (const [key, value] of Object.entries(document)) {
      if (this._isLargeField(value)) {
        binaryFields[key] = value;
        metadata[key] = { __binary: true, __type: typeof value };
      } else {
        metadata[key] = value;
      }
    }
    
    const metadataJson = JSON.stringify(metadata);
    const binaryData = Buffer.from(JSON.stringify(binaryFields));
    
    // Create hybrid format: [metadata_length][metadata][binary_data]
    const metadataBuffer = Buffer.from(metadataJson, 'utf8');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(metadataBuffer.length, 0);
    
    return Buffer.concat([lengthBuffer, metadataBuffer, binaryData]);
  }

  _deserializeHybrid(data) {
    // Read metadata length
    const metadataLength = data.readUInt32BE(0);
    
    // Read metadata
    const metadataBuffer = data.slice(4, 4 + metadataLength);
    const metadata = JSON.parse(metadataBuffer.toString('utf8'));
    
    // Read binary data
    const binaryBuffer = data.slice(4 + metadataLength);
    const binaryFields = JSON.parse(binaryBuffer.toString('utf8'));
    
    // Reconstruct document
    const document = { ...metadata };
    for (const [key, info] of Object.entries(metadata)) {
      if (info && info.__binary) {
        document[key] = binaryFields[key];
      }
    }
    
    return document;
  }

  _isLargeField(value) {
    if (typeof value === 'string') {
      return value.length > 1000; // Strings larger than 1KB
    }
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return JSON.stringify(value).length > 1000;
    }
    return false;
  }

  async _readFile(filePath) {
    if (this.compression && filePath.endsWith('.gz')) {
      return this._readCompressedFile(filePath);
    }
    const data = await fs.readFile(filePath);
    this.stats.totalBytes += data.length;
    if (this.format === 'json') {
      return data.toString('utf8');
    }
    if (this.format === 'db') {
      return Buffer.from(data); // Always return Buffer for .db
    }
    return data;
  }

  async _writeFile(filePath, data) {
    if (this.compression) {
      return this._writeCompressedFile(filePath + '.gz', data);
    }
    // .db formatında sadece Buffer yazılmalı
    let buffer;
    if (this.format === 'db') {
      if (!Buffer.isBuffer(data)) {
        throw new Error('DB formatında sadece Buffer yazılabilir!');
      }
      buffer = data;
    } else {
      buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    }
    await fs.writeFile(filePath, buffer);
    this.stats.totalBytes += buffer.length;
  }

  async _readCompressedFile(filePath) {
    const chunks = [];
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    await pipeline(readStream, gunzipStream);
    
    gunzipStream.on('data', chunk => chunks.push(chunk));
    
    const buffer = Buffer.concat(chunks);
    this.stats.totalBytes += buffer.length;
    
    return this.format === 'json' ? buffer.toString('utf8') : buffer;
  }

  async _writeCompressedFile(filePath, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip();
    
    await pipeline(
      gzipStream,
      writeStream
    );
    
    gzipStream.write(buffer);
    gzipStream.end();
    
    this.stats.totalBytes += buffer.length;
  }

  async _ensureDirectory(dirPath) {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async _writeMetadata(collectionName, metadata) {
    const metadataPath = this._getMetadataPath(collectionName);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async _readMetadata(collectionName) {
    const metadataPath = this._getMetadataPath(collectionName);
    
    if (!existsSync(metadataPath)) {
      return null;
    }
    
    const data = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(data);
  }

  async _updateCollectionMetadata(collectionName, updates) {
    const metadata = await this._readMetadata(collectionName) || {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string' && value.startsWith('+')) {
        metadata[key] = (metadata[key] || 0) + parseInt(value.substring(1));
      } else if (typeof value === 'string' && value.startsWith('-')) {
        metadata[key] = (metadata[key] || 0) - parseInt(value.substring(1));
      } else {
        metadata[key] = value;
      }
    }
    
    metadata.lastModified = new Date();
    await this._writeMetadata(collectionName, metadata);
  }

  async _createArchiveBackup(backupPath, metadata) {
    // Create a simple archive format
    const archive = {
      metadata,
      collections: {}
    };
    
    for (const collectionName of metadata.collections) {
      const documents = await this.listDocuments(collectionName);
      archive.collections[collectionName] = documents;
    }
    
    const archiveData = JSON.stringify(archive, null, 2);
    await fs.writeFile(backupPath, archiveData);
  }

  async _createDirectoryBackup(backupPath, metadata) {
    await this._ensureDirectory(backupPath);
    
    // Copy collections
    const sourceCollectionsPath = join(this.basePath, 'collections');
    const backupCollectionsPath = join(backupPath, 'collections');
    
    if (existsSync(sourceCollectionsPath)) {
      await this._copyDirectory(sourceCollectionsPath, backupCollectionsPath);
    }
    
    // Copy metadata
    const sourceMetadataPath = join(this.basePath, 'metadata');
    const backupMetadataPath = join(backupPath, 'metadata');
    
    if (existsSync(sourceMetadataPath)) {
      await this._copyDirectory(sourceMetadataPath, backupMetadataPath);
    }
    
    // Write backup metadata
    await fs.writeFile(
      join(backupPath, 'backup.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  async _copyDirectory(source, destination) {
    await this._ensureDirectory(destination);
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = join(source, entry.name);
      const destPath = join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this._copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  async _restoreFromArchive(backupPath) {
    const archiveData = await fs.readFile(backupPath, 'utf8');
    const archive = JSON.parse(archiveData);
    
    // Restore collections
    for (const [collectionName, documents] of Object.entries(archive.collections)) {
      await this.createCollection(collectionName);
      
      for (const document of documents) {
        await this.insert(collectionName, document);
      }
    }
  }

  async _restoreFromDirectory(backupPath) {
    // Restore collections directory
    const backupCollectionsPath = join(backupPath, 'collections');
    if (existsSync(backupCollectionsPath)) {
      const targetCollectionsPath = join(this.basePath, 'collections');
      await this._copyDirectory(backupCollectionsPath, targetCollectionsPath);
    }
    
    // Restore metadata directory
    const backupMetadataPath = join(backupPath, 'metadata');
    if (existsSync(backupMetadataPath)) {
      const targetMetadataPath = join(this.basePath, 'metadata');
      await this._copyDirectory(backupMetadataPath, targetMetadataPath);
    }
  }
}

export default StorageEngine;
