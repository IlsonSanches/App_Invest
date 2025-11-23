import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- RECONSTRUÇÃO TOTAL DE FLUXO DE CAIXA ---\n');
  console.log('Recalculando aportes e resgates baseado puramente na variação de saldo...\n');

  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      }
    }
  });

  let stats = { lucro: 0, aporte: 0, prejuizo: 0, resgate: 0 };

  for (const asset of assets) {
    if (asset.records.length < 2) continue;

    // 1. Garante que o primeiro registro é Aporte Inicial puro
    const first = asset.records[0];
    if (first.amountAdded !== first.totalValue) {
        await prisma.dailyRecord.update({
            where: { id: first.id },
            data: { amountAdded: first.totalValue, amountRemoved: 0 }
        });
    }

    // 2. Recalcula o resto mês a mês
    for (let i = 1; i < asset.records.length; i++) {
      const prev = asset.records[i - 1];
      const curr = asset.records[i];

      const diff = curr.totalValue - prev.totalValue;
      const percent = (diff / prev.totalValue) * 100;

      let newAdded = 0;
      let newRemoved = 0;

      if (diff > 0) {
        // SUBIU
        if (percent > 2.5) {
           // Subiu mais que 2.5% num mês -> Provavelmente Aporte
           // (Renda Fixa não rende isso, Bolsa pode render, mas vamos ser conservadores: assumir aporte para não inflar ROI)
           newAdded = diff; 
           stats.aporte++;
        } else {
           // Subiu pouco -> É Lucro orgânico
           // newAdded = 0;
           stats.lucro++;
        }
      } else if (diff < 0) {
        // CAIU
        if (percent < -10.0) { 
           // Caiu mais que 10% -> Quase certeza que é Resgate (mesmo na bolsa, cair 10% num mês consolidado é raro/crítico, mas possível. Vamos por segurança marcar como resgate se for muito brusco para não jogar ROI no chão)
           // Ajuste: Se for Renda Fixa/Tesouro, qualquer queda > 0.1% é resgate (pois não tem mark-to-market negativo tão forte mensalmente no extrato consolidado geralmente, a menos que seja marcação a mercado forte).
           // Vamos usar -5% como corte geral.
           newRemoved = Math.abs(diff);
           stats.resgate++;
        } else {
           // Caiu pouco -> Oscilação de mercado (Prejuízo normal)
           // newRemoved = 0;
           stats.prejuizo++;
        }
      }

      // Atualiza o registro
      await prisma.dailyRecord.update({
        where: { id: curr.id },
        data: {
            amountAdded: newAdded,
            amountRemoved: newRemoved
        }
      });
    }
  }

  console.log('\nReconstrução concluída!');
  console.log(`Movimentações detectadas:`);
  console.log(`- Lucros Orgânicos mantidos: ${stats.lucro}`);
  console.log(`- Prejuízos de Mercado mantidos: ${stats.prejuizo}`);
  console.log(`- Novos Aportes registrados (>2.5%): ${stats.aporte}`);
  console.log(`- Novos Resgates registrados (<-5%): ${stats.resgate}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

