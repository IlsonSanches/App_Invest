'use client'

import { useState } from 'react'
import { createBank, createAsset, addDailyRecord, uploadExcel } from '../actions'
import { Plus, TrendingUp, DollarSign, Landmark, Calendar, Upload } from 'lucide-react'
import EvolutionChart from './EvolutionChart'
import AIReport from './AIReport'
import Link from 'next/link'

type Props = {
  summary: any
  banks: any[]
}

export default function DashboardClient({ summary, banks }: Props) {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')
  const [uploadMessage, setUploadMessage] = useState('')

  // Formatação de moeda
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Minha Carteira</h1>
          <p className="text-gray-500">Acompanhamento de Rentabilidade</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            title="Importar Excel do Inter"
          >
            <Upload size={18} /> <span className="hidden md:inline">Importar Excel</span>
          </button>
          <button 
            onClick={() => setIsAssetModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus size={18} /> <span className="hidden md:inline">Novo Ativo</span>
          </button>
          <button 
            onClick={() => setIsRecordModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <Calendar size={18} /> <span className="hidden md:inline">Atualizar</span>
          </button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Patrimônio Total</p>
              <h3 className="text-2xl font-bold">{formatCurrency(summary.totalBalance)}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total de Ativos</p>
              <h3 className="text-2xl font-bold">{summary.assetCount}</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Landmark size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">Rentabilidade</p>
              <h3 className={`text-2xl font-bold ${summary.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.roi?.toFixed(2) || '0.00'}%
              </h3>
              <p className={`text-xs ${summary.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                 {formatCurrency(summary.profit || 0)}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${summary.roi >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold mb-4">Evolução Patrimonial</h2>
        <EvolutionChart data={summary.history} />
      </div>

      {/* Lista de Ativos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Seus Ativos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Instituição</th>
                <th className="p-4">Tipo</th>
                <th className="p-4 text-right">Saldo Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.assets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Nenhum ativo cadastrado. Comece adicionando um!
                  </td>
                </tr>
              ) : (
                summary.assets.map((asset: any) => (
                  <tr key={asset.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium">
                      <Link href={`/assets/${asset.id}`} className="text-blue-600 hover:underline font-semibold">
                        {asset.name}
                      </Link>
                    </td>
                    <td className="p-4">{asset.bank.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{asset.type}</span>
                    </td>
                    <td className="p-4 text-right font-mono">
                      {asset.records[0] ? formatCurrency(asset.records[0].totalValue) : 'R$ 0,00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Relatório de IA */}
      <div className="mt-8">
        <AIReport assets={summary.assets} totalBalance={summary.totalBalance} roi={summary.roi} />
      </div>

      {/* MODAL: Novo Ativo */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Adicionar Novo Ativo</h2>
            <form action={async (formData) => {
              await createAsset(formData)
              setIsAssetModalOpen(false)
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Ativo</label>
                  <input name="name" required className="w-full border rounded-lg p-2" placeholder="Ex: CDB Banco Inter" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select name="type" className="w-full border rounded-lg p-2">
                    <option value="CDB">CDB</option>
                    <option value="Ação">Ação</option>
                    <option value="Fundo">Fundo de Investimento</option>
                    <option value="Tesouro">Tesouro Direto</option>
                    <option value="Crypto">Criptomoeda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instituição</label>
                  <div className="flex gap-2">
                    <select name="bankId" className="w-full border rounded-lg p-2">
                      {banks.map(bank => (
                        <option key={bank.id} value={bank.id}>{bank.name}</option>
                      ))}
                    </select>
                  </div>
                  {banks.length === 0 && <p className="text-xs text-red-500 mt-1">Nenhum banco cadastrado. Cadastre um banco primeiro.</p>}
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsAssetModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
            
            {/* Mini form para adicionar banco rápido se não houver */}
            {banks.length === 0 && (
               <form action={async (fd) => {
                 await createBank(fd.get('name') as string)
               }} className="mt-4 pt-4 border-t">
                 <label className="text-xs font-bold">Cadastrar Banco Rápido:</label>
                 <div className="flex gap-2 mt-1">
                   <input name="name" placeholder="Nome do Banco" className="border rounded p-1 text-sm flex-1" />
                   <button className="text-xs bg-gray-200 px-2 rounded">Add</button>
                 </div>
               </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Upload Excel */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload size={24} className="text-indigo-600" />
              Importar Relatório
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Envie o arquivo Excel (.xlsx) consolidado para atualizar sua carteira.
            </p>
            
            <form action={async (formData) => {
              setUploadMessage('Processando...')
              const result = await uploadExcel(formData)
              setUploadMessage(result.message)
              if (result.success) {
                setTimeout(() => {
                    setIsUploadModalOpen(false)
                    setUploadMessage('')
                }, 2000)
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Referência</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border rounded-lg p-2" />
                  <p className="text-xs text-gray-400 mt-1">Data para registrar os saldos</p>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition">
                  <input type="file" name="file" accept=".xlsx" required className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>

                {uploadMessage && (
                  <div className={`p-3 rounded-lg text-sm ${uploadMessage.includes('sucesso') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {uploadMessage}
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Enviar Arquivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Atualizar Saldo */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Atualizar Diário</h2>
            <form action={async (formData) => {
              await addDailyRecord(formData)
              setIsRecordModalOpen(false)
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full border rounded-lg p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ativo</label>
                  <select name="assetId" required className="w-full border rounded-lg p-2">
                    <option value="">Selecione...</option>
                    {summary.assets.map((asset: any) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saldo do Dia (R$)</label>
                  <input type="number" step="0.01" name="totalValue" required className="w-full border rounded-lg p-2" placeholder="0,00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aporte (+)</label>
                    <input type="number" step="0.01" name="amountAdded" className="w-full border rounded-lg p-2" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resgate (-)</label>
                    <input type="number" step="0.01" name="amountRemoved" className="w-full border rounded-lg p-2" placeholder="0,00" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button type="button" onClick={() => setIsRecordModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

