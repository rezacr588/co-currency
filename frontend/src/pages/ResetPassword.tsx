import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Container } from '../components/layout';
import { Button, Input, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { ROUTES } from '../constants/routes';

export function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await api.auth.resetPassword({ token, new_password: newPassword });
      setSuccess(true);
      setTimeout(() => {
        navigate(ROUTES.login);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="flex-1 py-8">
        <Container>
          <div className="max-w-md mx-auto">
            <Card>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Invalid Reset Link
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  The password reset link is invalid or has expired.
                </p>
                <Link to={ROUTES.forgotPassword}>
                  <Button variant="primary">Request New Link</Button>
                </Link>
              </div>
            </Card>
          </div>
        </Container>
      </main>
    );
  }

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
                  Password Reset Successful
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Your password has been reset. Redirecting to login...
                </p>
                <Link to={ROUTES.login}>
                  <Button variant="primary">Go to Login</Button>
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
                {t('resetPassword') || 'Reset Password'}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Enter your new password
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('newPassword') || 'New Password'}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
              />

              <Input
                label={t('confirmPassword') || 'Confirm Password'}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </Card>
        </div>
      </Container>
    </main>
  );
}
