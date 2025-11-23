import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Normaliza nome do ativo (remove descrição longa)
function normalizeAsset(fullName: string): string {
  if (!fullName) return 'DESCONHECIDO';
  const parts = fullName.split(' - ');
  const tickerCandidate = parts[0].trim();
  if (tickerCandidate.includes('Tesouro')) {
      return tickerCandidate;
  }
  return tickerCandidate;
}

async function main() {
  const filePath = path.join(process.cwd(), 'movimentacao-2025-11-23-11-31-13.xlsx');
  
  console.log(`Lendo arquivo: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(worksheet);

  console.log(`Total de linhas: ${rows.length}`);

  const transactions = rows.map((row: any) => {
     // Parse Data '21/11/2025'
     if (!row['Data']) return null; // Pula linhas vazias
     
     const dateParts = row['Data'].split('/');
     const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`);
     
     return {
         ...row,
         parsedDate: date
     };
  })
  .filter((t: any) => t !== null)
  .sort((a: any, b: any) => a.parsedDate.getTime() - b.parsedDate.getTime());

  console.log('Importando transações...');

  let count = 0;

  for (const t of transactions) {
      const type = t['Entrada/Saída']; 
      const bankName = t['Instituição']?.trim() || 'Desconhecido';
      const assetName = normalizeAsset(t['Produto']);
      
      // Tratamento seguro do valor
      let rawValue = t['Valor da Operação'];
      if (typeof rawValue === 'string') rawValue = parseFloat(rawValue.replace('R$', '').trim());
      const value = isNaN(rawValue) ? 0 : rawValue;
      
      if (!t['Produto'] || t['Produto'] === '-') continue;
      if (value <= 0) continue; // Ignora valores zero (ex: movimentação informativa)

      // 1. Banco
      let bank = await prisma.bank.findFirst({ where: { name: bankName } });
      if (!bank) {
          bank = await prisma.bank.create({ data: { name: bankName } });
      }

      // 2. Ativo
      let assetType = 'Outros';
      if (assetName.includes('Tesouro')) assetType = 'Tesouro Direto';
      else if (assetName.endsWith('11')) assetType = 'Fundo/ETF'; 
      else if (assetName.endsWith('3') || assetName.endsWith('4')) assetType = 'Ação';
      else if (t['Produto'].includes('CDB') || t['Produto'].includes('LCI') || t['Produto'].includes('DEB')) assetType = 'Renda Fixa';

      let asset = await prisma.asset.findFirst({
          where: { name: assetName, bankId: bank.id }
      });

      if (!asset) {
          asset = await prisma.asset.create({
              data: { name: assetName, type: assetType, bankId: bank.id }
          });
      }

      // 3. Registro Diário
      let record = await prisma.dailyRecord.findUnique({
          where: {
              date_assetId: { date: t.parsedDate, assetId: asset.id }
          }
      });

      let amountAdded = 0;
      let amountRemoved = 0;

      if (type === 'Debito') {
          amountAdded = value;
      } else if (type === 'Credito') {
          amountRemoved = value;
      }

      if (record) {
          await prisma.dailyRecord.update({
              where: { id: record.id },
              data: {
                  amountAdded: { increment: amountAdded },
                  amountRemoved: { increment: amountRemoved }
              }
          });
      } else {
          await prisma.dailyRecord.create({
              data: {
                  date: t.parsedDate,
                  assetId: asset.id,
                  totalValue: 0, 
                  amountAdded,
                  amountRemoved
              }
          });
      }
      count++;
  }

  console.log(`Importação concluída! ${count} transações processadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
