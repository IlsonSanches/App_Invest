import { getAssetDetails } from '../../../actions'
import EvolutionChart from '../../../components/EvolutionChart'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, DollarSign, Calendar } from 'lucide-react'

export default async function AssetPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const asset = await getAssetDetails(id)

  if (!asset) {
    return <div className="p-8 text-center">Ativo não encontrado.</div>
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 mb-4">
            <ArrowLeft size={20} /> Voltar para Dashboard
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{asset.name}</h1>
              <p className="text-gray-500">{asset.bank.name} • {asset.type}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Saldo Atual</p>
              <h2 className="text-3xl font-bold text-blue-600">{formatCurrency(asset.currentBalance)}</h2>
            </div>
          </div>
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Investido</p>
                <h3 className="text-xl font-bold">{formatCurrency(asset.totalInvested)}</h3>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-600">
                <DollarSign size={20} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">Lucro/Prejuízo</p>
                <h3 className={`text-xl font-bold ${asset.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(asset.profit)}
                </h3>
              </div>
              <div className={`p-2 rounded-lg ${asset.profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 mb-1">Rentabilidade</p>
                <h3 className={`text-xl font-bold ${asset.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {asset.roi.toFixed(2)}%
                </h3>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold mb-4">Evolução Histórica</h2>
          <EvolutionChart data={asset.history} />
        </div>

        {/* Tabela de Registros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Histórico de Registros</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4 text-right">Saldo Total</th>
                <th className="p-4 text-right">Aporte</th>
                <th className="p-4 text-right">Resgate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asset.records.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center">Nenhum registro.</td></tr>
              ) : (
                asset.records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-4 flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      {new Date(r.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-right font-mono font-medium">{formatCurrency(r.totalValue)}</td>
                    <td className="p-4 text-right text-green-600">{r.amountAdded > 0 ? `+ ${formatCurrency(r.amountAdded)}` : '-'}</td>
                    <td className="p-4 text-right text-red-600">{r.amountRemoved > 0 ? `- ${formatCurrency(r.amountRemoved)}` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

