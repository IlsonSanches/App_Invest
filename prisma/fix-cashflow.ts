import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- AJUSTE AUTOMÁTICO DE FLUXO DE CAIXA ---\n');
  console.log('Detectando variações bruscas de saldo para criar Aportes/Resgates implícitos...');

  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      }
    }
  });

  let fixedCount = 0;

  for (const asset of assets) {
    if (asset.records.length < 2) continue;

    for (let i = 1; i < asset.records.length; i++) {
      const prev = asset.records[i - 1];
      const curr = asset.records[i];

      // Variação do saldo
      const diff = curr.totalValue - prev.totalValue;
      
      // Se já tem movimentação registrada manualmente, respeita (a menos que seja insuficiente?)
      // Vamos assumir que se está zerado, precisamos calcular.
      if (curr.amountAdded === 0 && curr.amountRemoved === 0) {
        
        // Limiar de 2% (assumindo que rentabilidade normal mensal dificilmente passa disso sem ser bitcoin)
        // Se variou mais que 2%, consideramos movimentação financeira.
        const threshold = prev.totalValue * 0.02; 
        
        if (diff > threshold) {
          // SUBIU muito -> Aporte Implícito
          // Mas quanto foi aporte e quanto foi lucro?
          // Vamos assumir conservadoramente que TUDO que excedeu 1% foi aporte?
          // Ou simplificar: Diferença total é aporte. (Zera o lucro desse mês, mas corrige o acumulado)
          // Melhor: Considerar aporte = diff. Isso neutraliza o ROI desse mês específico, mas corrige o saldo investido.
          
          await prisma.dailyRecord.update({
            where: { id: curr.id },
            data: { amountAdded: diff }
          });
          fixedCount++;
          
        } else if (diff < -threshold) {
          // CAIU muito -> Resgate Implícito
          // Ex: Caiu de 230k para 50k. Diff = -180k.
          // Resgate deve ser positivo (+180k)
          
          await prisma.dailyRecord.update({
            where: { id: curr.id },
            data: { amountRemoved: Math.abs(diff) }
          });
          fixedCount++;
        }
      }
    }
  }

  console.log(`\nConcluído! ${fixedCount} registros ajustados com movimentações implícitas.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

