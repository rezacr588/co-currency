import { ProtectedRoute } from '../ProtectedRoute';
import { AppLayout } from './AppLayout';

export function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
