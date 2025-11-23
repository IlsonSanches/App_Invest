import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('--- LIMPEZA DE REGISTROS POR DATA ---');
  console.log('Isso apagará TODOS os registros de saldo da data informada.');
  console.log('Use isso se você importou arquivos com a data errada.\n');

  rl.question('Digite a data para limpar (formato YYYY-MM-DD, ex: 2025-11-22): ', async (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00.000Z'); // Ajuste de fuso simples, considerando UTC do banco
    // Ou melhor, buscar range do dia todo para evitar problemas de fuso

    const start = new Date(dateStr + 'T00:00:00.000Z');
    const end = new Date(dateStr + 'T23:59:59.999Z');

    if (isNaN(start.getTime())) {
      console.error('Data inválida!');
      process.exit(1);
    }

    try {
      const count = await prisma.dailyRecord.count({
        where: {
          date: {
            gte: start,
            lte: end
          }
        }
      });

      if (count === 0) {
        console.log('Nenhum registro encontrado nesta data.');
        process.exit(0);
      }

      console.log(`Encontrados ${count} registros.`);
      
      rl.question('Tem certeza que deseja apagar? (s/n): ', async (answer) => {
        if (answer.toLowerCase() === 's') {
          await prisma.dailyRecord.deleteMany({
             where: {
                date: {
                    gte: start,
                    lte: end
                }
             }
          });
          console.log('Registros apagados com sucesso!');
        } else {
          console.log('Operação cancelada.');
        }
        process.exit(0);
      });

    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}

main();

