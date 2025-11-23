import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDITORIA DE RENTABILIDADE ---\n');

  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      },
      bank: true
    }
  });

  let globalInvested = 0;
  let globalBalance = 0;

  console.log('TOP 10 ATIVOS COM MAIOR "VALOR INVESTIDO" (Que puxam o ROI pra baixo):');
  console.log('Nome | Banco | Saldo Atual | Total Aportado (Investido) | Diferença');
  console.log('-'.repeat(80));

  const assetMetrics = assets.map(asset => {
    const lastRecord = asset.records[asset.records.length - 1];
    const currentBalance = lastRecord?.totalValue || 0;
    
    // Soma de todos os aportes registrados no histórico
    const totalInvested = asset.records.reduce((acc, r) => acc + (r.amountAdded || 0), 0);
    const totalRemoved = asset.records.reduce((acc, r) => acc + (r.amountRemoved || 0), 0);
    const netInvested = totalInvested - totalRemoved;

    globalInvested += netInvested;
    globalBalance += currentBalance;

    return {
      name: asset.name,
      bank: asset.bank.name,
      currentBalance,
      netInvested,
      diff: currentBalance - netInvested,
      recordsCount: asset.records.length
    };
  });

  // Ordena pelos que têm maior prejuízo nominal (Diferença negativa)
  const sortedByLoss = [...assetMetrics].sort((a, b) => a.diff - b.diff);

  sortedByLoss.slice(0, 15).forEach(a => {
    console.log(
      `${a.name.padEnd(25).slice(0, 25)} | ` +
      `${a.bank.padEnd(15).slice(0, 15)} | ` +
      `R$ ${a.currentBalance.toFixed(2).padStart(10)} | ` +
      `R$ ${a.netInvested.toFixed(2).padStart(10)} | ` +
      `R$ ${a.diff.toFixed(2).padStart(10)} (${a.recordsCount} regs)`
    );
  });

  console.log('\n--- RESUMO GERAL ---');
  console.log(`Saldo Total em Carteira:  R$ ${globalBalance.toFixed(2)}`);
  console.log(`Total Considerado Aporte: R$ ${globalInvested.toFixed(2)}`);
  console.log(`Lucro/Prejuízo Calc.:     R$ ${(globalBalance - globalInvested).toFixed(2)}`);
  
  const roi = globalInvested !== 0 ? ((globalBalance - globalInvested) / globalInvested) * 100 : 0;
  console.log(`ROI Global Calculado:     ${roi.toFixed(2)}%`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

