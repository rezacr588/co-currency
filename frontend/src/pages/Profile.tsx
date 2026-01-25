import { useEffect, useMemo, useState } from 'react';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';

type ProfileFormState = {
  name: string;
  email: string;
  avatar_url: string;
};

export function Profile() {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: '',
    email: '',
    avatar_url: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      avatar_url: user.avatar_url || '',
    });
  }, [user]);

  const initials = useMemo(() => {
    if (profileForm.name) {
      return profileForm.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    if (profileForm.email) {
      return profileForm.email.slice(0, 2).toUpperCase();
    }
    return 'CF';
  }, [profileForm.name, profileForm.email]);

  const hasPassword = user?.has_password ?? true;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload: Record<string, string> = {};
    if (profileForm.name !== user.name) payload.name = profileForm.name;
    if (profileForm.email !== user.email) payload.email = profileForm.email;
    if ((profileForm.avatar_url || '') !== (user.avatar_url || '')) {
      payload.avatar_url = profileForm.avatar_url;
    }

    if (Object.keys(payload).length === 0) {
      toast.info(t('noChanges') || 'No changes to save.');
      return;
    }

    setProfileSaving(true);
    try {
      await api.auth.updateProfile(payload);
      await refreshProfile();
      toast.success(t('profileUpdated') || 'Profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('updateFailed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const MAX_SIZE_BYTES = 1024 * 1024; // 1MB
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(t('uploadPhotoHint') || 'Image must be under 1MB.');
      return;
    }

    setAvatarLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      setProfileForm(prev => ({ ...prev, avatar_url: dataUrl }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('updateFailed'));
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.next.length < 6) {
      toast.error(t('passwordTooShort'));
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }

    setPasswordSaving(true);
    try {
      await api.auth.changePassword({
        current_password: hasPassword ? passwordForm.current : undefined,
        new_password: passwordForm.next,
      });
      setPasswordForm({ current: '', next: '', confirm: '' });
      toast.success(t(hasPassword ? 'passwordUpdated' : 'passwordSet') || 'Password updated.');
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('updateFailed'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {t('profile')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('profileSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('profileSettings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                    {profileForm.avatar_url ? (
                      <img src={profileForm.avatar_url} alt={profileForm.name || 'Avatar'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleAvatarUpload(file);
                            }
                          }}
                        />
                        {avatarLoading ? t('saving') : t('uploadPhoto')}
                      </label>
                      {profileForm.avatar_url && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setProfileForm(prev => ({ ...prev, avatar_url: '' }))}
                        >
                          {t('remove') || 'Remove'}
                        </Button>
                      )}
                      <span className="text-xs text-slate-400">{t('uploadPhotoHint')}</span>
                    </div>
                    <Input
                      type="url"
                      label={t('avatarUrl')}
                      placeholder="https://"
                      value={profileForm.avatar_url}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                    />
                    {user?.has_github_linked && (
                      <p className="text-xs text-slate-400">
                        {t('githubLinked')}
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <Input
                    type="text"
                    label={t('name')}
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('enterName')}
                  />
                  <Input
                    type="email"
                    label={t('email')}
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t('enterEmail')}
                    required
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" disabled={profileSaving}>
                      {profileSaving ? t('saving') : t('saveChanges')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t(hasPassword ? 'changePassword' : 'setPassword')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {hasPassword && (
                    <Input
                      type="password"
                      label={t('currentPassword')}
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                      placeholder={t('enterPassword')}
                      autoComplete="current-password"
                      required
                    />
                  )}
                  <Input
                    type="password"
                    label={t('newPassword')}
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, next: e.target.value }))}
                    placeholder={t('enterPassword')}
                    autoComplete="new-password"
                    required
                  />
                  <Input
                    type="password"
                    label={t('confirmPassword')}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder={t('confirmYourPassword')}
                    autoComplete="new-password"
                    required
                  />
                  <Button type="submit" variant="primary" className="w-full" disabled={passwordSaving}>
                    {passwordSaving ? t('saving') : t(hasPassword ? 'changePassword' : 'setPassword')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </main>
  );
}
