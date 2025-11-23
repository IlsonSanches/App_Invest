import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando limpeza total do banco de dados...');

  // A ordem importa por causa das chaves estrangeiras
  
  // 1. Apaga histórico diário (depende de Asset)
  const deletedRecords = await prisma.dailyRecord.deleteMany({});
  console.log(`Removidos ${deletedRecords.count} registros de histórico.`);

  // 2. Apaga ativos (depende de Bank)
  const deletedAssets = await prisma.asset.deleteMany({});
  console.log(`Removidos ${deletedAssets.count} ativos.`);

  // 3. Apaga bancos
  const deletedBanks = await prisma.bank.deleteMany({});
  console.log(`Removidos ${deletedBanks.count} bancos.`);

  console.log('\n--- LIMPEZA CONCLUÍDA ---');
  console.log('O banco de dados está vazio e pronto para novas importações.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

