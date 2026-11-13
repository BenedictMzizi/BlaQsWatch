import AppRoutes from './routes/AppRoutes';
import { InventoryProvider } from './context/InventoryContext';
export default function App(){return <InventoryProvider><AppRoutes /></InventoryProvider>;}
