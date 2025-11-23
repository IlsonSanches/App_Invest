const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'movimentacao-2025-11-23-11-31-13.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== ABAS DISPONÍVEIS ===');
console.log(workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`\n--- ESTRUTURA DA ABA: ${sheetName} ---`);
if (data.length > 0) console.log('Linha 1 (Cabeçalho?):', data[0]);
if (data.length > 1) console.log('Linha 2 (Dados?):', data[1]);
if (data.length > 2) console.log('Linha 3 (Dados?):', data[2]);

