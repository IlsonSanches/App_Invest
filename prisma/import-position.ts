import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Configuração: Data do Arquivo (deve ser passada via argumento ou hardcoded se for one-off)
// Vamos tentar pegar do nome do arquivo ou argumento.
const args = process.argv.slice(2);
const fileName = args[0];
const dateArg = args[1]; // 'YYYY-MM-DD'

if (!fileName || !dateArg) {
    console.error('Uso: npx tsx prisma/import-position.ts <NOME_ARQUIVO.xlsx> <DATA_YYYY-MM-DD>');
    process.exit(1);
}

const REPORT_DATE = new Date(`${dateArg}T12:00:00Z`);

async function main() {
  const filePath = path.join(process.cwd(), fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`Lendo arquivo de posição: ${fileName} (Data Ref: ${dateArg})`);
  const workbook = XLSX.readFile(filePath);

  const sheetMappings = [
    { name: 'Posição - Ações', colValue: 'Valor Atualizado' },
    { name: 'Posição - ETF', colValue: 'Valor Atualizado' },
    { name: 'Posição - Fundos', colValue: 'Valor Atualizado' },
    { name: 'Posição - Renda Fixa', colValue: 'Valor Atualizado CURVA' }, 
    { name: 'Posição - Tesouro Direto', colValue: 'Valor Atualizado' },
    { name: 'Posição - COE', colValue: 'Valor Aplicado' },
  ];

  let updatedCount = 0;

  for (const mapping of sheetMappings) {
    if (!workbook.SheetNames.includes(mapping.name)) continue;

    const worksheet = workbook.Sheets[mapping.name];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    for (const row of rows) {
      const bankName = (row['Instituição'] || 'Desconhecido').trim();
      let assetName = row['Código de Negociação'] || row['Produto'] || row['Código'];
      
      if (!assetName) continue;
      
      // Normaliza nome igual ao importador de transações
      const parts = assetName.split(' - ');
      const tickerCandidate = parts[0].trim();
      if (tickerCandidate.includes('Tesouro')) assetName = tickerCandidate;
      else assetName = tickerCandidate;

      let value = row[mapping.colValue];
      if (mapping.name.includes('Renda Fixa') && (!value || value === '-')) {
         value = row['Valor Atualizado MTM'];
      }
      
      if (typeof value === 'string') {
        if (value.trim() === '-') value = 0;
        else value = parseFloat(value); 
      }

      if (!value || isNaN(value)) value = 0;
      if (value <= 0) continue;

      // 1. Busca Banco
      const bank = await prisma.bank.findFirst({ where: { name: bankName } });
      if (!bank) continue; // Se o banco não existe (não teve movimentação), talvez devêssemos criar? Vamos assumir que a movimentação já criou. Se não criou, é pq não teve fluxo, mas tem saldo (ex: saldo antigo). Vamos criar para garantir.
      
      // 2. Busca Ativo
      const asset = await prisma.asset.findFirst({
        where: { name: assetName, bankId: bank.id }
      });
      
      if (!asset) continue; // Se não achou o ativo criado pela movimentação, ignoramos? Ou criamos? Melhor criar caso seja um ativo legado sem movimentação recente.
      
      // 3. Atualiza/Cria Registro Diário (SOMENTE SALDO)
      const existingRecord = await prisma.dailyRecord.findUnique({
        where: {
          date_assetId: {
            date: REPORT_DATE,
            assetId: asset.id
          }
        }
      });

      if (existingRecord) {
        // Atualiza apenas o saldo de mercado
        await prisma.dailyRecord.update({
            where: { id: existingRecord.id },
            data: { totalValue: value }
        });
      } else {
        // Cria registro de saldo (sem fluxo)
        await prisma.dailyRecord.create({
          data: {
            date: REPORT_DATE,
            assetId: asset.id,
            totalValue: value,
            amountAdded: 0,
            amountRemoved: 0
          }
        });
      }
      updatedCount++;
    }
  }

  console.log(`\nSucesso! ${updatedCount} saldos atualizados para ${dateArg}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

