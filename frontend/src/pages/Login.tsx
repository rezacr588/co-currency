import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { api } from '../api';
import { GitHubIcon } from '../constants/icons';
import { ROUTES } from '../constants/routes';

export function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: string })?.from || ROUTES.wallet;

  // Check for error from OAuth callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubLogin = () => {
    // Redirect to GitHub OAuth
    window.location.href = api.auth.getGitHubAuthUrl();
  };

  return (
    <main className="flex-1 py-8 sm:py-12">
      <Container>
        <div className="max-w-md mx-auto">
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('login')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                {/* GitHub OAuth Button */}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 !bg-slate-900 hover:!bg-slate-800 !text-white !border-slate-700"
                  onClick={handleGitHubLogin}
                  disabled={isSubmitting}
                >
                  <GitHubIcon className="w-5 h-5" />
                  Continue with GitHub
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {t('or') || 'or'}
                    </span>
                  </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    label={t('email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('enterEmail')}
                    required
                    autoComplete="email"
                    disabled={isSubmitting}
                  />

                  <Input
                    type="password"
                    label={t('password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('enterPassword')}
                    required
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />

                  <div className="text-right">
                    <Link
                      to={ROUTES.forgotPassword}
                      className="text-sm text-primary-700 dark:text-primary-500 hover:underline"
                    >
                      {t('forgotPassword') || 'Forgot password?'}
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('loggingIn') : t('login')}
                  </Button>
                </form>

                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  {t('noAccount')}{' '}
                  <Link
                    to={ROUTES.register}
                    className="text-primary-700 dark:text-primary-500 hover:underline font-medium"
                  >
                    {t('register')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
