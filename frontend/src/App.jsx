import AppRoutes from './routes/AppRoutes';
import { InventoryProvider } from './context/InventoryContext';
import Footer from './components/layout/Footer';

export default function App() {
  return (
    <InventoryProvider>
      <div className="app-shell">
        <main className="app-main">
          <AppRoutes />
        </main>

        <Footer />
      </div>
    </InventoryProvider>
  );
}
