const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'relatorio-consolidado-mensal-2025-outubro.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== ABAS DISPONÍVEIS ===');
console.log(workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (data.length > 0) {
        console.log(`\n--- ABA: ${sheetName} ---`);
        console.log('Cabeçalho:', data[0]);
        // Mostra uma linha de exemplo se houver dados
        if (data.length > 1) console.log('Exemplo:', data[1]);
    }
});
