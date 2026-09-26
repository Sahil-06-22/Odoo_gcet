import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/AppLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Main App Pages
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/products/ProductsPage';
import StockPage from './pages/StockPage';
import ReceiptsPage from './pages/receipts/ReceiptsPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';
import DeliveriesPage from './pages/deliveries/DeliveriesPage';
import DeliveryDetailPage from './pages/deliveries/DeliveryDetailPage';
import TransfersPage from './pages/transfers/TransfersPage';
import TransferDetailPage from './pages/transfers/TransferDetailPage';
import AdjustmentsPage from './pages/adjustments/AdjustmentsPage';
import MoveHistoryPage from './pages/MoveHistoryPage';
import WarehousesPage from './pages/settings/WarehousesPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null; // restoring session from the refresh cookie
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="stock" element={<StockPage />} />
              
              {/* Receipts */}
              <Route path="receipts" element={<ReceiptsPage />} />
              <Route path="receipts/new" element={<ReceiptDetailPage />} />
              <Route path="receipts/:id" element={<ReceiptDetailPage />} />

              {/* Delivery Orders */}
              <Route path="deliveries" element={<DeliveriesPage />} />
              <Route path="deliveries/new" element={<DeliveryDetailPage />} />
              <Route path="deliveries/:id" element={<DeliveryDetailPage />} />

              {/* Internal Transfers */}
              <Route path="transfers" element={<TransfersPage />} />
              <Route path="transfers/new" element={<TransferDetailPage />} />
              <Route path="transfers/:id" element={<TransferDetailPage />} />

              {/* Inventory Adjustments */}
              <Route path="adjustments" element={<AdjustmentsPage />} />

              {/* Move History / Stock Ledger */}
              <Route path="move-history" element={<MoveHistoryPage />} />

              {/* Warehouse Settings */}
              <Route path="settings/warehouses" element={<WarehousesPage />} />

              {/* Profile */}
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
