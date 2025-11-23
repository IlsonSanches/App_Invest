import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDITORIA COMPARATIVA: MARÇO vs OUTUBRO 2025 ---\n');

  // Definindo as datas de corte
  const startData = new Date('2025-03-31T00:00:00.000Z');
  const endData = new Date('2025-10-31T00:00:00.000Z');

  // Busca todos os ativos
  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      },
      bank: true
    }
  });

  console.log('Nome do Ativo'.padEnd(30) + 
              ' | ' + 'Saldo Março'.padStart(12) + 
              ' | ' + '+ Aportes'.padStart(12) + 
              ' | ' + '- Resgates'.padStart(12) + 
              ' | ' + 'Saldo Out'.padStart(12) + 
              ' | ' + 'Rendimento'.padStart(12) + 
              ' | ' + 'ROI %'.padStart(8));
  console.log('-'.repeat(115));

  let totalStart = 0;
  let totalEnd = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalYield = 0;

  for (const asset of assets) {
    // Encontra o registro mais próximo de Março (31/03)
    // Pode ser que o ativo não existisse em março.
    const startRecord = asset.records.find(r => r.date.toISOString().startsWith('2025-03-31'));
    const endRecord = asset.records.find(r => r.date.toISOString().startsWith('2025-10-31'));

    // Se não tem saldo em outubro, ignoramos (ou mostramos como saída total?)
    // Vamos focar nos que têm continuidade ou existiam em algum momento.
    if (!startRecord && !endRecord) continue;

    const startBal = startRecord ? startRecord.totalValue : 0;
    const endBal = endRecord ? endRecord.totalValue : 0;

    // Calcula movimentação ENTRE as datas (exclusive start, inclusive end)
    // Aportes feitos EM Março já contam no saldo de Março? Sim.
    // Então queremos aportes feitos APÓS 31/03 até 31/10.
    
    let periodAdded = 0;
    let periodRemoved = 0;

    asset.records.forEach(r => {
      if (r.date > startData && r.date <= endData) {
        periodAdded += r.amountAdded;
        periodRemoved += r.amountRemoved;
      }
    });

    // Lucro = (Final) - (Inicial + Aportes - Resgates)
    // Capital Exposto = Inicial + Aportes - Resgates (simplificado)
    const netFlow = periodAdded - periodRemoved;
    const expectedNoYield = startBal + netFlow;
    const yieldVal = endBal - expectedNoYield;
    
    // ROI do período
    const baseCapital = startBal + periodAdded; // Denominador simples para ROI
    const roi = baseCapital > 0 ? (yieldVal / baseCapital) * 100 : 0;

    // Acumula totais
    totalStart += startBal;
    totalEnd += endBal;
    totalAdded += periodAdded;
    totalRemoved += periodRemoved;
    totalYield += yieldVal;

    // Exibe apenas se teve alguma relevância (saldo > 0 ou movimentação)
    if (startBal > 0 || endBal > 0 || periodAdded > 0) {
       console.log(
         asset.name.slice(0, 29).padEnd(30) + 
         ' | ' + startBal.toFixed(2).padStart(12) + 
         ' | ' + periodAdded.toFixed(2).padStart(12) + 
         ' | ' + periodRemoved.toFixed(2).padStart(12) + 
         ' | ' + endBal.toFixed(2).padStart(12) + 
         ' | ' + yieldVal.toFixed(2).padStart(12) + 
         ' | ' + roi.toFixed(1).padStart(7) + '%'
       );
    }
  }

  console.log('-'.repeat(115));
  console.log(
     'TOTAIS'.padEnd(30) + 
     ' | ' + totalStart.toFixed(2).padStart(12) + 
     ' | ' + totalAdded.toFixed(2).padStart(12) + 
     ' | ' + totalRemoved.toFixed(2).padStart(12) + 
     ' | ' + totalEnd.toFixed(2).padStart(12) + 
     ' | ' + totalYield.toFixed(2).padStart(12) + 
     ' | ' + (totalStart > 0 ? ((totalYield/(totalStart+totalAdded))*100).toFixed(1) : '0.0').padStart(7) + '%'
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

