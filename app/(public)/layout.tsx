import Header from '@/components/Header'
import Footer from '@/components/Footer'
import WelcomeToast from '@/components/WelcomeToast'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />
      <main className="flex-1 w-full overflow-x-clip">
        {children}
      </main>
      <Footer />
      <WelcomeToast />
    </div>
  )
}
