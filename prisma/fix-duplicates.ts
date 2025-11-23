import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeString(str: string): string {
  return str
    .toUpperCase()
    .replace(/[\.\-\/]/g, ' ')
    .replace(/\s+S\s*A\s*$/g, '')
    .replace(/\s+SA\s*$/g, '')
    .replace(/\s+LTDA\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function mergeBanks() {
  console.log('--- FASE 1: Unificação de Bancos ---');
  const banks = await prisma.bank.findMany();
  const normalizedGroups: Record<string, typeof banks> = {};

  for (const bank of banks) {
    const key = normalizeString(bank.name);
    if (!normalizedGroups[key]) normalizedGroups[key] = [];
    normalizedGroups[key].push(bank);
  }

  for (const key in normalizedGroups) {
    const group = normalizedGroups[key];
    if (group.length > 1) {
      console.log(`\nFundindo bancos similares: "${key}"`);
      // Mantém o primeiro (menor ID) como principal
      const [primary, ...duplicates] = group.sort((a, b) => a.id - b.id);
      
      console.log(`  Principal: [${primary.id}] ${primary.name}`);
      
      for (const dup of duplicates) {
        console.log(`  -> Migrando ativos de [${dup.id}] ${dup.name}...`);
        
        // Move ativos para o banco principal
        await prisma.asset.updateMany({
          where: { bankId: dup.id },
          data: { bankId: primary.id }
        });

        // Apaga o banco duplicado
        await prisma.bank.delete({ where: { id: dup.id } });
      }
    }
  }
}

async function mergeAssets() {
  console.log('\n--- FASE 2: Unificação de Ativos ---');
  const assets = await prisma.asset.findMany({
    include: { records: true }
  });
  
  // Agrupa por: Nome Normalizado + ID do Banco (agora unificados)
  const groups: Record<string, typeof assets> = {};

  for (const asset of assets) {
    const key = `${normalizeString(asset.name)}|${asset.bankId}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(asset);
  }

  for (const key in groups) {
    const group = groups[key];
    if (group.length > 1) {
      const groupName = group[0].name;
      console.log(`\nFundindo ativos similares: "${groupName}" (Total: ${group.length})`);
      
      // Ordena: Ativos com MAIS registros têm prioridade para ser o Principal? 
      // Ou o mais antigo? Vamos pegar o que tem o nome mais "limpo" ou simplesmente o primeiro ID.
      // Vamos usar o ID mais baixo como principal.
      const [primary, ...duplicates] = group.sort((a, b) => a.id - b.id);

      console.log(`  Principal: [${primary.id}] ${primary.name}`);

      for (const dup of duplicates) {
        console.log(`  -> Migrando registros de [${dup.id}] ${dup.name}...`);
        
        for (const record of dup.records) {
          // Verifica se já existe registro nessa data no principal
          const conflict = await prisma.dailyRecord.findUnique({
            where: {
              date_assetId: {
                date: record.date,
                assetId: primary.id
              }
            }
          });

          if (conflict) {
            // Se já existe, atualiza o valor se o duplicado for mais recente (ou ignora? Geralmente queremos o dado mais novo)
            // Como estamos limpando duplicatas, vamos assumir que queremos manter o dado que já estava lá ou somar?
            // RUMO SA e RUMO S.A. provavelmente são o mesmo dado importado em meses diferentes.
            // Se conflitar a data, é melhor não fazer nada (já tem o dado lá) e só apagar o registro duplicado.
            console.log(`     X Conflito em ${record.date.toISOString().split('T')[0]} - ignorando registro duplicado.`);
          } else {
            // Move o registro para o ativo principal
            await prisma.dailyRecord.update({
              where: { id: record.id },
              data: { assetId: primary.id }
            });
          }
        }

        // Apaga o ativo duplicado (seus registros restantes devem ser apagados antes devido a FK, ou updateCascade? Prisma default é restrict)
        // Precisamos apagar os registros que sobraram no duplicado (os conflitantes que ignoramos)
        await prisma.dailyRecord.deleteMany({ where: { assetId: dup.id } });
        await prisma.asset.delete({ where: { id: dup.id } });
        console.log(`     ✓ Ativo duplicado removido.`);
      }
    }
  }
}

async function main() {
  await mergeBanks();
  await mergeAssets();
  console.log('\nProcesso de unificação concluído!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

