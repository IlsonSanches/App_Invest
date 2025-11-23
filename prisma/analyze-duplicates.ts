import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[\.\-\/]/g, ' ') // Troca pontuação por espaço
    .replace(/\s+S\s*A\s*$/g, '') // Remove S.A. do final
    .replace(/\s+SA\s*$/g, '')    // Remove SA do final
    .replace(/\s+LTDA\s*$/g, '')  // Remove LTDA
    .replace(/\s+/g, ' ')         // Remove espaços duplos
    .trim();
}

async function main() {
  console.log('Analisando possíveis duplicatas...\n');

  const assets = await prisma.asset.findMany({
    include: { bank: true, _count: { select: { records: true } } }
  });

  const groups: Record<string, typeof assets> = {};

  // Agrupa por nome normalizado
  for (const asset of assets) {
    // Chave composta: Nome Normalizado + ID do Banco
    // (Ativos de bancos diferentes podem ter nomes iguais mas serem coisas diferentes, mas geralmente queremos mergear se for o mesmo papel mesmo em bancos diferentes? Não, melhor manter segregado por banco por segurança, ou avisar).
    // O usuário mencionou "RUMO", que provavelmente é o mesmo papel. Mas se estiver em bancos diferentes, fisicamente são custódias diferentes.
    // Pela imagem/descrição, parece ser inconsistência de nome mesmo.
    
    // Vamos agrupar puramente por nome normalizado para ver o que aparece.
    // Se for o mesmo banco, é duplicata certa. Se for banco diferente, é alerta.
    
    const key = `${normalizeName(asset.name)}|${asset.bankId}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(asset);
  }

  let foundDuplicates = false;

  for (const key in groups) {
    if (groups[key].length > 1) {
      foundDuplicates = true;
      console.log(`🔴 GRUPO SUSPEITO (Banco ID: ${key.split('|')[1]}):`);
      
      groups[key].forEach(asset => {
        console.log(`   [ID: ${asset.id}] "${asset.name}" - ${asset._count.records} registros - Banco: ${asset.bank.name}`);
      });
      console.log('---------------------------------------------------');
    }
  }

  if (!foundDuplicates) {
    console.log('Nenhuma duplicata óbvia encontrada com os critérios atuais.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

