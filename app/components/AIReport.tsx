'use client'

import { Brain, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react'

type Asset = {
  name: string
  type: string
  currentBalance: number
  roi: number
  bank: { name: string }
}

type Props = {
  assets: Asset[]
  totalBalance: number
  roi: number
}

export default function AIReport({ assets, totalBalance, roi }: Props) {
  // Lógica de Análise (Simulando IA)
  
  // 1. Análise de Alocação
  const allocationByType = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + asset.currentBalance
    return acc
  }, {} as Record<string, number>)

  const topType = Object.entries(allocationByType).sort((a, b) => b[1] - a[1])[0]
  const topTypePerc = ((topType?.[1] || 0) / totalBalance) * 100

  // 2. Análise de Concentração
  const topAsset = assets[0] // Já vem ordenado do backend
  const topAssetPerc = (topAsset.currentBalance / totalBalance) * 100
  const isConcentrated = topAssetPerc > 25

  // 3. Análise de Performance
  // Filtra ativos com saldo relevante (> 1% do total) para não analisar "restos"
  const relevantAssets = assets.filter(a => a.currentBalance > (totalBalance * 0.01))
  const bestAsset = [...relevantAssets].sort((a, b) => b.roi - a.roi)[0]
  const worstAsset = [...relevantAssets].sort((a, b) => a.roi - b.roi)[0]

  // GERAÇÃO DO TEXTO (Prompt Engineering via Código)
  const insights = []

  // Insight Geral
  if (roi > 10) {
    insights.push({ type: 'positive', text: `Sua carteira está com excelente performance global (+${roi.toFixed(1)}%).` })
  } else if (roi < 0) {
    insights.push({ type: 'negative', text: `A carteira está sofrendo desvalorização global (${roi.toFixed(1)}%). Momento de cautela.` })
  } else {
    insights.push({ type: 'neutral', text: `Sua carteira apresenta estabilidade (+${roi.toFixed(1)}%).` })
  }

  // Insight de Diversificação
  if (isConcentrated) {
    insights.push({ 
      type: 'warning', 
      text: `Alerta de concentração: O ativo "${topAsset.name}" representa ${topAssetPerc.toFixed(0)}% do seu patrimônio. Considere diversificar para reduzir riscos.` 
    })
  } else {
    insights.push({ 
      type: 'positive', 
      text: `Boa diversificação! Seu maior ativo representa apenas ${topAssetPerc.toFixed(0)}% do total.` 
    })
  }

  // Insight de Estratégia
  if (topTypePerc > 70 && topType[0].includes('Renda Fixa')) {
    insights.push({ type: 'neutral', text: `Perfil Conservador detectado. Você tem ${topTypePerc.toFixed(0)}% em ${topType[0]}.` })
  } else if (topTypePerc > 60 && (topType[0].includes('Ação') || topType[0].includes('Fundo'))) {
    insights.push({ type: 'neutral', text: `Perfil Arrojado detectado. Grande exposição em Renda Variável (${topTypePerc.toFixed(0)}%).` })
  }

  // Insight de Vencedores/Perdedores
  if (bestAsset && bestAsset.roi > 0) {
    insights.push({ type: 'positive', text: `Destaque positivo: "${bestAsset.name}" entregou +${bestAsset.roi.toFixed(1)}% de retorno.` })
  }
  if (worstAsset && worstAsset.roi < -5) {
    insights.push({ type: 'negative', text: `Atenção: "${worstAsset.name}" está puxando a rentabilidade para baixo com ${worstAsset.roi.toFixed(1)}%. Avalie se os fundamentos mudaram.` })
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-6 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-6 border-b border-indigo-100 pb-4">
        <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-200 shadow-lg">
          <Brain size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Análise Inteligente da Carteira</h2>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider">IA Assistant Beta</p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex gap-3 items-start">
            <div className="mt-1 shrink-0">
              {insight.type === 'positive' && <CheckCircle size={18} className="text-green-500" />}
              {insight.type === 'negative' && <TrendingDown size={18} className="text-red-500" />}
              {insight.type === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
              {insight.type === 'neutral' && <TrendingUp size={18} className="text-blue-500" />}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {insight.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-indigo-50 text-xs text-center text-gray-400">
        *Análise gerada automaticamente com base nos dados históricos informados.
      </div>
    </div>
  )
}

