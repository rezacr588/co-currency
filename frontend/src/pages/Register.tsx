import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { api } from '../api';
import { LinkedInIcon, GoogleIcon } from '../constants/icons';
import { ROUTES } from '../constants/routes';

export function Register() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ email, password, name });
      navigate(ROUTES.wallet, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
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
              <CardTitle>{t('register')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {error && <ErrorMessage>{error}</ErrorMessage>}

                {/* Google OAuth Button */}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 !bg-white hover:!bg-gray-50 !text-gray-700 !border-gray-300"
                  onClick={() => {
                    window.location.href = api.auth.getGoogleAuthUrl();
                  }}
                  disabled={isSubmitting}
                >
                  <GoogleIcon className="w-5 h-5" />
                  Sign up with Google
                </Button>

                {/* LinkedIn OAuth Button */}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 !bg-[#0077b5] hover:!bg-[#006699] !text-white !border-[#0077b5]"
                  onClick={() => {
                    window.location.href = api.auth.getLinkedInAuthUrl();
                  }}
                  disabled={isSubmitting}
                >
                  <LinkedInIcon className="w-5 h-5" />
                  Sign up with LinkedIn
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
                  type="text"
                  label={t('name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('enterName')}
                  required
                  autoComplete="name"
                  disabled={isSubmitting}
                />

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
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />

                <Input
                  type="password"
                  label={t('confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmYourPassword')}
                  required
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('registering') : t('register')}
                </Button>

                </form>

                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  {t('alreadyHaveAccount')}{' '}
                  <Link
                    to={ROUTES.login}
                    className="text-primary-700 dark:text-primary-500 hover:underline font-medium"
                  >
                    {t('login')}
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
