'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

export async function getSummary() {
  // 1. Busca todos os ativos com TODOS os registros para cálculo preciso
  const assetsRaw = await prisma.asset.findMany({
    include: {
      records: {
        orderBy: { date: 'asc' } // Importante: Ordem cronológica
      },
      bank: true
    }
  })

  // 2. Processa cada ativo para calcular métricas individuais
  const assets = assetsRaw.map(asset => {
    const lastRecord = asset.records[asset.records.length - 1]
    const currentBalance = lastRecord?.totalValue || 0
    
    // Soma fluxos de entrada e saída de TODO o histórico do ativo
    const totalInvested = asset.records.reduce((acc, r) => acc + (r.amountAdded || 0) - (r.amountRemoved || 0), 0)
    
    const profit = currentBalance - totalInvested
    const roi = totalInvested !== 0 ? (profit / totalInvested) * 100 : 0

    return {
      ...asset,
      records: [lastRecord], // Mantém compatibilidade com o front retornando só o último aqui
      currentBalance,
      totalInvested,
      profit,
      roi
    }
  })

  // 3. Totais da Carteira
  const totalBalance = assets.reduce((acc, a) => acc + a.currentBalance, 0)
  const totalInvestedPortfolio = assets.reduce((acc, a) => acc + a.totalInvested, 0)
  const totalProfit = totalBalance - totalInvestedPortfolio
  const totalRoi = totalInvestedPortfolio !== 0 ? (totalProfit / totalInvestedPortfolio) * 100 : 0

  // 4. Histórico Consolidado (Gráfico)
  const historyData = await prisma.dailyRecord.groupBy({
    by: ['date'],
    _sum: {
      totalValue: true
    },
    orderBy: {
      date: 'asc'
    }
  })

  const history = historyData.map(item => ({
    date: item.date.toISOString().split('T')[0],
    value: item._sum.totalValue || 0
  }))

  return {
    totalBalance,
    assetCount: assets.length,
    assets: assets.sort((a, b) => b.currentBalance - a.currentBalance), // Ordena por maior valor
    history,
    roi: totalRoi,
    profit: totalProfit
  }
}

export async function getBanks() {
  return await prisma.bank.findMany()
}

export async function createBank(name: string) {
  await prisma.bank.create({ data: { name } })
  revalidatePath('/')
}

export async function createAsset(formData: FormData) {
  const name = formData.get('name') as string
  const type = formData.get('type') as string
  const bankId = parseInt(formData.get('bankId') as string)

  await prisma.asset.create({
    data: {
      name,
      type,
      bankId
    }
  })
  revalidatePath('/')
}

export async function addDailyRecord(formData: FormData) {
  const assetId = parseInt(formData.get('assetId') as string)
  const date = new Date(formData.get('date') as string)
  const totalValue = parseFloat(formData.get('totalValue') as string)
  const amountAdded = parseFloat(formData.get('amountAdded') as string) || 0
  const amountRemoved = parseFloat(formData.get('amountRemoved') as string) || 0

  // Verifica se já existe registro nesse dia
  const existing = await prisma.dailyRecord.findUnique({
    where: {
      date_assetId: {
        date,
        assetId
      }
    }
  })

  if (existing) {
    await prisma.dailyRecord.update({
      where: { id: existing.id },
      data: { totalValue, amountAdded, amountRemoved }
    })
  } else {
    await prisma.dailyRecord.create({
      data: {
        date,
        assetId,
        totalValue,
        amountAdded,
        amountRemoved
      }
    })
  }
  revalidatePath('/')
}

export async function uploadExcel(formData: FormData) {
  const file = formData.get('file') as File
  const dateStr = formData.get('date') as string
  
  if (!file) return { success: false, message: 'Nenhum arquivo enviado' }
  
  // Se não informou data, tenta pegar do nome do arquivo ou usa hoje
  const reportDate = dateStr ? new Date(dateStr) : new Date()
  
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheetMappings = [
      { name: 'Posição - Ações', type: 'Ação', colValue: 'Valor Atualizado' },
      { name: 'Posição - ETF', type: 'ETF', colValue: 'Valor Atualizado' },
      { name: 'Posição - Fundos', type: 'Fundo', colValue: 'Valor Atualizado' },
      { name: 'Posição - Renda Fixa', type: 'Renda Fixa', colValue: 'Valor Atualizado CURVA' },
      { name: 'Posição - Tesouro Direto', type: 'Tesouro Direto', colValue: 'Valor Atualizado' },
      { name: 'Posição - COE', type: 'COE', colValue: 'Valor Aplicado' },
    ]

    let processedCount = 0

    for (const mapping of sheetMappings) {
      if (!workbook.SheetNames.includes(mapping.name)) continue

      const worksheet = workbook.Sheets[mapping.name]
      const rows = XLSX.utils.sheet_to_json<any>(worksheet)

      for (const row of rows) {
        const bankName = (row['Instituição'] || 'Desconhecido').trim()
        let assetName = row['Código de Negociação'] || row['Produto'] || row['Código']
        
        if (!assetName) continue

        let value = row[mapping.colValue]
        if (mapping.type === 'Renda Fixa' && (!value || value === '-')) {
           value = row['Valor Atualizado MTM']
        }
        
        if (typeof value === 'string') {
          if (value.trim() === '-') value = 0
          else value = parseFloat(value)
        }

        if (!value || isNaN(value)) value = 0
        if (value <= 0) continue

        // 1. Busca ou Cria Banco
        let bank = await prisma.bank.findFirst({ where: { name: bankName } })
        if (!bank) {
          bank = await prisma.bank.create({ data: { name: bankName } })
        }

        // 2. Busca ou Cria Ativo
        let asset = await prisma.asset.findFirst({
          where: { name: assetName, bankId: bank.id }
        })

        if (!asset) {
          asset = await prisma.asset.create({
            data: { name: assetName, type: mapping.type, bankId: bank.id }
          })
        }

        // 3. Cria/Atualiza Registro Diário
        const existingRecord = await prisma.dailyRecord.findUnique({
          where: {
            date_assetId: { date: reportDate, assetId: asset.id }
          }
        })

        if (existingRecord) {
          await prisma.dailyRecord.update({
            where: { id: existingRecord.id },
            data: { totalValue: value }
          })
        } else {
          // Se for o primeiro registro ever, considera como aporte inicial
          const isFirstRecord = (await prisma.dailyRecord.count({ where: { assetId: asset.id } })) === 0
          
          await prisma.dailyRecord.create({
            data: {
              date: reportDate,
              assetId: asset.id,
              totalValue: value,
              amountAdded: isFirstRecord ? value : 0,
              amountRemoved: 0
            }
          })
        }
        processedCount++
      }
    }

    revalidatePath('/')
    return { success: true, message: `${processedCount} ativos processados com sucesso!` }
  } catch (error) {
    console.error('Erro ao processar Excel:', error)
    return { success: false, message: 'Erro ao processar o arquivo.' }
  }
}

export async function getAssetDetails(assetId: number) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      bank: true,
      records: {
        orderBy: { date: 'asc' }
      }
    }
  })

  if (!asset) return null

  const history = asset.records.map(r => ({
    date: r.date.toISOString().split('T')[0],
    value: r.totalValue
  }))

  const lastRecord = asset.records[asset.records.length - 1]
  const currentBalance = lastRecord?.totalValue || 0
  
  const totalInvested = asset.records.reduce((acc, r) => acc + r.amountAdded - r.amountRemoved, 0)
  const profit = currentBalance - totalInvested
  const roi = totalInvested !== 0 ? (profit / totalInvested) * 100 : 0

  return {
    ...asset,
    currentBalance,
    totalInvested,
    profit,
    roi,
    history
  }
}
