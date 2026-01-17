import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';

export function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: string })?.from || '/wallet';

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

  return (
    <main className="flex-1 py-8 sm:py-12">
      <Container>
        <div className="max-w-md mx-auto">
          <Card variant="gradient">
            <CardHeader>
              <CardTitle>{t('login')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <ErrorMessage>{error}</ErrorMessage>}

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

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('loggingIn') : t('login')}
                </Button>

                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  {t('noAccount')}{' '}
                  <Link
                    to="/register"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    {t('register')}
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
