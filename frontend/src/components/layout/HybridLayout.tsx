import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AppLayout } from './AppLayout';
import { PublicLayout } from './PublicLayout';

export function HybridLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return isAuthenticated ? <AppLayout /> : <PublicLayout />;
}
