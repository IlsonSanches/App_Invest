import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Data fixa para o relatório de Outubro
const REPORT_DATE = new Date('2025-10-31T12:00:00Z');

async function main() {
  const filePath = path.join(process.cwd(), 'relatorio-consolidado-mensal-2025-outubro.xlsx');
  
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
    { name: 'Posição - COE', type: 'COE', colValue: 'Valor Aplicado' }, // COE geralmente não tem liquidez diária, usando aplicado como base
  ];

  for (const mapping of sheetMappings) {
    if (!workbook.SheetNames.includes(mapping.name)) {
      console.log(`Aba ignorada (não encontrada): ${mapping.name}`);
      continue;
    }

    console.log(`\nProcessando aba: ${mapping.name}...`);
    const worksheet = workbook.Sheets[mapping.name];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    for (const row of rows) {
      // Tratamento de Dados
      const bankName = (row['Instituição'] || 'Desconhecido').trim();
      
      // Nome do Ativo: Tenta pegar o código primeiro, senão o nome completo
      let assetName = row['Código de Negociação'] || row['Produto'] || row['Código'];
      if (!assetName) continue; // Pula se não tiver nome
      
      // Se tiver código E nome, as vezes é legal combinar, mas vamos manter simples por enquanto: Código se houver, senão Nome.
      // Para Renda Fixa, o "Produto" costuma ser descritivo "CDB Banco X", o que é bom.
      
      // Valor
      let value = row[mapping.colValue];
      
      // Fallback para Renda Fixa se CURVA estiver vazio ou traço
      if (mapping.type === 'Renda Fixa' && (!value || value === '-')) {
         value = row['Valor Atualizado MTM'];
      }
      
      if (typeof value === 'string') {
        // Limpa caracteres de formatação se houver "R$ 1.000,00" -> 1000.00
        // Mas geralmente o XLSX lê como número se a célula estiver formatada.
        // Se for '-', considera 0
        if (value.trim() === '-') value = 0;
        else {
            // Tenta parsear floats br
            // Assumindo que o xlsx já converteu corretamente, mas se for string bruta:
             value = parseFloat(value); 
        }
      }

      if (!value || isNaN(value)) value = 0;

      if (value <= 0) continue; // Ignora ativos com saldo zero ou negativo

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

      // 3. Cria Registro Diário (Saldo)
      // Verifica se já existe registro para esta data e ativo
      const existingRecord = await prisma.dailyRecord.findUnique({
        where: {
          date_assetId: {
            date: REPORT_DATE,
            assetId: asset.id
          }
        }
      });

      if (existingRecord) {
        // Atualiza se já existe (evita duplicação se rodar o script 2x)
        await prisma.dailyRecord.update({
            where: { id: existingRecord.id },
            data: { totalValue: value }
        });
      } else {
        // Cria novo registro
        // Assumimos Aporte = Valor Total no primeiro registro para o cálculo de rentabilidade não ficar louco (ROI infinito)
        // Se for um registro histórico antigo, o ideal seria ter o histórico de aportes.
        // Como é uma "Carga Inicial" em data passada, vamos considerar como Saldo apenas.
        // O usuário deverá ajustar aportes se quiser precisão milimétrica no ROI histórico.
        // Mas para simplificar: Se é o PRIMEIRO registro desse ativo EVER, consideramos Aporte = Valor.
        
        const isFirstRecord = (await prisma.dailyRecord.count({ where: { assetId: asset.id } })) === 0;
        
        await prisma.dailyRecord.create({
          data: {
            date: REPORT_DATE,
            assetId: asset.id,
            totalValue: value,
            amountAdded: isFirstRecord ? value : 0, // Considera aporte inicial se for novo
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

