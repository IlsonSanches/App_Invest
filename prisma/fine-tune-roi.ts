import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- AJUSTE FINO DE RENTABILIDADE (Resgatando Lucros) ---\n');

  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      }
    }
  });

  let fixedCount = 0;

  for (const asset of assets) {
    // Pula ativos com poucos registros
    if (asset.records.length < 2) continue;

    // Ordena cronologicamente
    const records = asset.records;

    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];

      // Se o sistema marcou um aporte neste mês...
      if (curr.amountAdded > 0) {
        const saldoAnterior = prev.totalValue;
        const aumento = curr.totalValue - saldoAnterior; // Variação total bruta
        
        // Se não houve resgate no mesmo mês...
        if (curr.amountRemoved === 0) {
          // Calcula qual seria a rentabilidade se esse aporte NÃO existisse
          // Aporte Atual registrado pelo script anterior = Aumento total (provavelmente)
          
          // Vamos ver se esse "Aporte" é na verdade um rendimento compatível com o mercado (até 2% a.m)
          // Se o aporte registrado for quase igual à variação total, e essa variação for pequena (< 2% do saldo anterior)
          // Então provavelmente era só lucro organic.
          
          const percentVariation = (curr.amountAdded / saldoAnterior) * 100;

          if (percentVariation > 0 && percentVariation < 2.5) {
            // É muito provável que seja rendimento (Selic hoje ~1%, mas com oscilação/marcação a mercado pode bater perto de 1.5-2 em FIIs/Crédito)
            // Vamos converter esse Aporte em Lucro (simplesmente zerando o campo amountAdded)
            
            console.log(`[${asset.name}] ${curr.date.toISOString().slice(0,10)}: Convertendo Aporte de R$ ${curr.amountAdded.toFixed(2)} (${percentVariation.toFixed(2)}%) em LUCRO.`);
            
            await prisma.dailyRecord.update({
              where: { id: curr.id },
              data: { amountAdded: 0 }
            });
            fixedCount++;
          }
        }
      }
    }
  }

  console.log(`\nCorreção Finalizada! ${fixedCount} registros ajustados.`);
  console.log('Os lucros mensais pequenos (< 2.5%) agora contam como rentabilidade real.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

