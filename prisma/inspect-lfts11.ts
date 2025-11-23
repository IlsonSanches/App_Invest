import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- INVESTIGAÇÃO LFTS11 ---\n');

  const asset = await prisma.asset.findFirst({
    where: { name: { contains: 'LFTS11' } },
    include: { records: { orderBy: { date: 'asc' } } }
  });

  if (!asset) {
    console.log('Ativo não encontrado.');
    return;
  }

  console.log(`Ativo: ${asset.name} (ID: ${asset.id})`);
  console.log('Data       | Saldo Total | Aporte (+) | Resgate (-)');
  console.log('-'.repeat(50));

  asset.records.forEach(r => {
    console.log(
      `${r.date.toISOString().split('T')[0]} | ` +
      `R$ ${r.totalValue.toFixed(2).padStart(9)} | ` +
      `R$ ${r.amountAdded.toFixed(2).padStart(8)} | ` +
      `R$ ${r.amountRemoved.toFixed(2).padStart(8)}`
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

