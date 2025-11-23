import { getSummary, getBanks } from './actions'
import DashboardClient from './components/DashboardClient'

export default async function Home() {
  const summary = await getSummary()
  const banks = await getBanks()

  return (
    <main>
      <DashboardClient summary={summary} banks={banks} />
    </main>
  )
}
