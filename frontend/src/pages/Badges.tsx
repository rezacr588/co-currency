import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { BadgeGrid } from '../components/features/Badges';

export function Badges() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <BadgeGrid />
        </div>
    );
}
