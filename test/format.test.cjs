// Test for all supported formats in BigBaseAlpha storage
const fs = require('fs');
const path = require('path');
const { StorageEngine } = require('../src/storage/index.js');

const TEST_COLLECTION = 'test';
const TEST_ID = 'format-test';
const TEST_DOC = {
  id: TEST_ID,
  name: 'Format Test',
  value: 42,
  arr: [1,2,3],
  nested: { foo: 'bar', num: 7 }
};

const FORMATS = ['json', 'binary', 'hybrid', 'csv', 'xml', 'yaml', 'db'];

(async () => {
  for (const format of FORMATS) {
    const basePath = path.join(__dirname, 'format_test_' + format);
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath);
    const engine = new StorageEngine({ basePath, format });
    await engine._initFormat();
    let writeDoc = TEST_DOC;
    let fileName = `${TEST_ID}.${format}`;
    // CSV expects array of objects
    if (format === 'csv') {
      writeDoc = [TEST_DOC];
    }
    // .db test: use .db extension and ensure Buffer is used
    if (format === 'db') {
      fileName = `${TEST_ID}.db`;
    }
    // Write
    let serialized = await engine._serializeDocument(writeDoc);
    // Buffer requirement check for .db format
    if (format === 'db' && !Buffer.isBuffer(serialized)) {
      throw new Error('Serialized data must be a Buffer for .db format!');
    }
    if (format === 'db') {
      console.log('[db][write][header]', serialized.subarray(0, 16));
    }
    await engine._writeFile(
      path.join(basePath, fileName),
      serialized
    );
    // Read
    let data = await engine._readFile(
      path.join(basePath, fileName)
    );
    if (format === 'db') {
      console.log('[db][read][header]', data.subarray(0, 16));
    }
    const doc = await engine._deserializeDocument(data);
    console.log(`[${format}]`, doc);
    // Cleanup
    fs.rmSync(basePath, { recursive: true, force: true });
  }
  console.log('All format tests completed!');
})();
