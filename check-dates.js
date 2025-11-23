const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
  const records = await prisma.dailyRecord.groupBy({
    by: ['date'],
    _count: {
      id: true
    },
    _sum: {
      totalValue: true
    },
    orderBy: {
      date: 'asc'
    }
  });

  console.log('--- Datas encontradas no Banco de Dados ---');
  records.forEach(r => {
    console.log(`Data: ${r.date.toISOString().split('T')[0]} | Registros: ${r._count.id} | Total: ${r._sum.totalValue}`);
  });
}

checkDates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

