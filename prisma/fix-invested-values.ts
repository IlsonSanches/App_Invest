import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- CORREÇÃO DE APORTES DUPLICADOS ---\n');
  
  const assets = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' }
      }
    }
  });

  let updatedCount = 0;

  for (const asset of assets) {
    if (asset.records.length <= 1) continue;

    // O primeiro registro (índice 0) é o "Saldo Inicial", mantemos o amountAdded dele.
    // Todos os outros (índice 1 em diante) devem ter amountAdded zerado, 
    // POIS o script de importação antigo marcou erroneamente como aporte.
    
    // Exceção: Se quisermos ser muito inteligentes, poderíamos comparar:
    // Se (Saldo Atual) > (Saldo Anterior * 1.05), talvez seja aporte.
    // Mas para corrigir a "sujeira" atual, é melhor zerar os subsequentes.
    
    const recordsToFix = asset.records.slice(1); // Pula o primeiro
    
    for (const record of recordsToFix) {
      if (record.amountAdded > 0) {
        // Zera o aporte indevido
        await prisma.dailyRecord.update({
          where: { id: record.id },
          data: { amountAdded: 0 }
        });
        updatedCount++;
      }
    }
  }

  console.log(`\nCorreção concluída!`);
  console.log(`${updatedCount} registros de histórico tiveram seus "aportes duplicados" removidos.`);
  console.log('Agora o ROI deve refletir a realidade.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

