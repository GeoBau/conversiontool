// Test script to debug xlsx parsing
const XLSX = require('xlsx');
const fs = require('fs');

const filePath = './Vorlagen/test.xlsx';

console.log('Reading file:', filePath);

// Read file
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('\nWorkbook sheets:', workbook.SheetNames);

const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];

console.log('\nWorksheet:', firstSheetName);

// Test 1: with raw: false (convert to strings)
console.log('\n=== Test 1: raw: false ===');
const jsonData1 = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
console.log('Data:', JSON.stringify(jsonData1, null, 2));
console.log('Type of first cell:', typeof jsonData1[0]?.[0]);

// Test 2: with raw: true (keep original types)
console.log('\n=== Test 2: raw: true ===');
const jsonData2 = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
console.log('Data:', JSON.stringify(jsonData2, null, 2));
console.log('Type of first cell:', typeof jsonData2[0]?.[0]);

// Test 3: default (no raw option)
console.log('\n=== Test 3: default ===');
const jsonData3 = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log('Data:', JSON.stringify(jsonData3, null, 2));
console.log('Type of first cell:', typeof jsonData3[0]?.[0]);

// Simulate parsing column A (index 0)
console.log('\n=== Simulating parseExcel for column A (index 0) ===');
const colIndex = 0;
const numbers = [];

let startIndex = 0;
if (jsonData1.length > 0) {
  const firstRow = jsonData1[0];
  if (firstRow && firstRow.length > colIndex) {
    const cellValue = firstRow[colIndex];
    console.log('First cell value:', cellValue, 'type:', typeof cellValue);
    if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
      const firstValue = String(cellValue).trim();
      console.log('First value as string:', firstValue);
      const isNumber = /^\d+(\.\d+)*$/.test(firstValue);
      console.log('Is numeric?', isNumber);
      if (firstValue && !isNumber) {
        startIndex = 1;
        console.log('Detected header, skipping first row');
      }
    }
  }
}

console.log(`\nParsing from row ${startIndex}:`);
for (let i = startIndex; i < jsonData1.length; i++) {
  const row = jsonData1[i];
  console.log(`Row ${i}:`, row);
  if (row && row.length > colIndex) {
    const cellValue = row[colIndex];
    console.log(`  Cell value:`, cellValue, 'type:', typeof cellValue);
    if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
      const value = String(cellValue).trim();
      console.log(`  String value:`, value);
      if (value && value !== 'undefined' && value !== 'null') {
        numbers.push(value);
        console.log(`  ✓ Added to numbers`);
      }
    }
  }
}

console.log('\n=== Final result ===');
console.log('Numbers found:', numbers);
console.log('Count:', numbers.length);
