import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- INVESTIGAÇÃO DE NOMES ---\n');

  // 1. Lista ativos que contêm "RUMO" (caso específico relatado)
  const rumoAssets = await prisma.asset.findMany({
    where: {
      name: { contains: 'RUMO' }
    },
    include: { bank: true, _count: { select: { records: true } } }
  });

  console.log('Ativos contendo "RUMO":');
  rumoAssets.forEach(a => {
    console.log(`[ID: ${a.id}] "${a.name}" (Banco: ${a.bank.name}) - Registros: ${a._count.records}`);
  });

  // 2. Listagem Geral para inspeção visual (limitada)
  console.log('\n--- TODOS OS ATIVOS (AMOSTRA) ---');
  const allAssets = await prisma.asset.findMany({
    take: 50,
    orderBy: { name: 'asc' },
    include: { bank: true }
  });
  
  allAssets.forEach(a => {
    console.log(`[ID: ${a.id}] "${a.name}"`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

