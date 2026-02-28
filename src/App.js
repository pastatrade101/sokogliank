import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/authContext';
import { ThemeProvider } from './contexts/themeContext';
import LoginScreen from './components/LoginScreen';
import HomeShell from './components/HomeShell';
import AdminShell from './components/AdminShell';
import SignalsPage from './components/SignalsPage';
import TipsPage from './components/TipsPage';
import AdminUserManagementPage from './components/AdminUserManagementPage';
import AdminContentManagementPage from './components/AdminContentManagementPage';
import AdminRevenuePage from './components/AdminRevenuePage';
import AdminNotificationPage from './components/AdminNotificationPage';
import AuthGate from './components/AuthGate';
import PolicyPage from './components/PolicyPage';
import PremiumUpgradePage from './components/PremiumUpgradePage';
import { ToastProvider } from './components/ui';
import { MotionProvider } from './design/motion';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <MotionProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<AuthGate><HomeShell /></AuthGate>} />
                <Route path="/auth" element={<LoginScreen />} />
                <Route path="/admin" element={<AuthGate><AdminShell /></AuthGate>} />
                <Route path="/admin/users" element={<AuthGate><AdminUserManagementPage /></AuthGate>} />
                <Route path="/admin/content" element={<AuthGate><AdminContentManagementPage /></AuthGate>} />
                <Route path="/admin/revenue" element={<AuthGate><AdminRevenuePage /></AuthGate>} />
                <Route path="/admin/notifications" element={<AuthGate><AdminNotificationPage /></AuthGate>} />
                <Route path="/signals" element={<AuthGate><SignalsPage /></AuthGate>} />
                <Route path="/tips" element={<AuthGate><TipsPage /></AuthGate>} />
                <Route path="/upgrade" element={<AuthGate><PremiumUpgradePage /></AuthGate>} />
                <Route path="/terms" element={<PolicyPage />} />
                <Route path="/privacy" element={<PolicyPage />} />
                <Route path="/risk-disclaimer" element={<PolicyPage />} />
              </Routes>
            </BrowserRouter>
          </MotionProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
