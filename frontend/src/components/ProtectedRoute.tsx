import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from './ui/Skeleton';
import { Container } from './layout';
import { ROUTES } from '../constants/routes';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          <div className="max-w-md mx-auto space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Container>
      </main>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login with the current location saved
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
