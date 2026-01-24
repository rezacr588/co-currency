import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '../components/layout';
import { Button, Input, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.auth.forgotPassword({ email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex-1 py-8">
        <Container>
          <div className="max-w-md mx-auto">
            <Card>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Check your email
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  If an account exists with {email}, we've sent a password reset link.
                </p>
                <Link to="/login">
                  <Button variant="primary">Back to Login</Button>
                </Link>
              </div>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="flex-1 py-8">
      <Container>
        <div className="max-w-md mx-auto">
          <Card>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('forgotPassword') || 'Forgot Password'}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('email') || 'Email'}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-primary-700 dark:text-primary-500 hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  );
}
