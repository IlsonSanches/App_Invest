const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// Data fixa para o relatório de Outubro
const REPORT_DATE = new Date('2025-10-31T12:00:00Z');

async function main() {
  const filePath = path.join(__dirname, '../relatorio-consolidado-mensal-2025-outubro.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`Lendo arquivo: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  // Mapeamento de Abas para Tipos de Ativos
  const sheetMappings = [
    { name: 'Posição - Ações', type: 'Ação', colValue: 'Valor Atualizado' },
    { name: 'Posição - ETF', type: 'ETF', colValue: 'Valor Atualizado' },
    { name: 'Posição - Fundos', type: 'Fundo', colValue: 'Valor Atualizado' },
    { name: 'Posição - Renda Fixa', type: 'Renda Fixa', colValue: 'Valor Atualizado CURVA' }, // Prioridade Curva
    { name: 'Posição - Tesouro Direto', type: 'Tesouro Direto', colValue: 'Valor Atualizado' },
    { name: 'Posição - COE', type: 'COE', colValue: 'Valor Aplicado' },
  ];

  for (const mapping of sheetMappings) {
    if (!workbook.SheetNames.includes(mapping.name)) {
      console.log(`Aba ignorada (não encontrada): ${mapping.name}`);
      continue;
    }

    console.log(`\nProcessando aba: ${mapping.name}...`);
    const worksheet = workbook.Sheets[mapping.name];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    for (const row of rows) {
      // Tratamento de Dados
      const bankName = (row['Instituição'] || 'Desconhecido').trim();
      
      // Nome do Ativo: Tenta pegar o código primeiro, senão o nome completo
      let assetName = row['Código de Negociação'] || row['Produto'] || row['Código'];
      if (!assetName) continue; // Pula se não tiver nome
      
      // Valor
      let value = row[mapping.colValue];
      
      // Fallback para Renda Fixa
      if (mapping.type === 'Renda Fixa' && (!value || value === '-')) {
         value = row['Valor Atualizado MTM'];
      }
      
      if (typeof value === 'string') {
        if (value.trim() === '-') value = 0;
        else value = parseFloat(value); 
      }

      if (!value || isNaN(value)) value = 0;

      if (value <= 0) continue; // Ignora ativos com saldo zero

      // 1. Busca ou Cria Banco
      let bank = await prisma.bank.findFirst({ where: { name: bankName } });
      if (!bank) {
        console.log(`Criando banco: ${bankName}`);
        bank = await prisma.bank.create({ data: { name: bankName } });
      }

      // 2. Busca ou Cria Ativo
      let asset = await prisma.asset.findFirst({
        where: { 
            name: assetName,
            bankId: bank.id
        }
      });

      if (!asset) {
        console.log(`Criando ativo: ${assetName} (${mapping.type})`);
        asset = await prisma.asset.create({
          data: {
            name: assetName,
            type: mapping.type,
            bankId: bank.id
          }
        });
      }

      // 3. Cria Registro Diário
      const existingRecord = await prisma.dailyRecord.findUnique({
        where: {
          date_assetId: {
            date: REPORT_DATE,
            assetId: asset.id
          }
        }
      });

      if (existingRecord) {
        await prisma.dailyRecord.update({
            where: { id: existingRecord.id },
            data: { totalValue: value }
        });
      } else {
        const isFirstRecord = (await prisma.dailyRecord.count({ where: { assetId: asset.id } })) === 0;
        
        await prisma.dailyRecord.create({
          data: {
            date: REPORT_DATE,
            assetId: asset.id,
            totalValue: value,
            amountAdded: isFirstRecord ? value : 0,
            amountRemoved: 0
          }
        });
      }
    }
  }

  console.log('\nImportação concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

