import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthToken, setRefreshToken } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../components/layout';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';

export function GitHubCallback() {
    const { t } = useLanguage();
    const { refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const refreshToken = searchParams.get('refresh_token');
            const errorParam = searchParams.get('error');

            if (errorParam) {
                setError(errorParam);
                return;
            }

            if (token) {
                // Store the tokens
                setAuthToken(token);
                if (refreshToken) {
                    setRefreshToken(refreshToken);
                }

                // Refresh the user profile
                try {
                    await refreshProfile();
                    navigate(ROUTES.wallet, { replace: true });
                } catch {
                    setError('Failed to load user profile');
                }
            } else {
                setError('No authentication token received');
            }
        };

        handleCallback();
    }, [searchParams, navigate, refreshProfile]);

    return (
        <main className="flex-1 py-8 sm:py-12">
            <Container>
                <div className="max-w-md mx-auto text-center">
                    {error ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
                                {t('authError') || 'Authentication Error'}
                            </h2>
                            <p className="text-red-600 dark:text-red-300 mb-6">{error}</p>
                            <Button 
                                variant="primary" 
                                onClick={() => navigate(ROUTES.login, { replace: true })}
                                className="w-full"
                            >
                                {t('backToHome') || 'Back to Login'}
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                            <p className="text-slate-600 dark:text-slate-300">
                                {t('completingLogin') || 'Completing login...'}
                            </p>
                        </div>
                    )}
                </div>
            </Container>
        </main>
    );
}
