import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_LABELS, Locale, useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Mail, Globe } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const { t } = useTranslation('onboarding');
  const { locale, set_locale } = useI18n();
  const { login } = useAuth();
  const [email, set_email] = useState('');
  const [password, set_password] = useState('');
  const [is_submitting, set_is_submitting] = useState(false);

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_is_submitting(true);

    try {
      await login(email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('login.sign_in_failed');
      toast.error(message);
    } finally {
      set_is_submitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card rounded-xl shadow-card p-8 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl tracking-tight">C</span>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('login.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('login.welcome')}</p>
            </div>
          </div>

          <div className="flex justify-center">
            <Select value={locale} onValueChange={(v) => set_locale(v as Locale)}>
              <SelectTrigger className="w-48">
                <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['it', 'fr', 'de', 'en'] as Locale[]).map((l) => (
                  <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handle_submit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t('login.email_placeholder')}
                  value={email}
                  onChange={(e) => set_email(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder={t('login.password_placeholder')}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={is_submitting}>
              {is_submitting ? '...' : t('login.sign_in')}
            </Button>
          </form>

          <div className="space-y-2 text-center">
            <a href="/portale-recovery" className="text-xs text-muted-foreground hover:text-primary hover:underline block">
              Password dimenticata?
            </a>
            <p className="text-sm text-muted-foreground">
              {t('login.new_club_question')} <a href="/registrati" className="text-primary underline">{t('login.register_here')}</a>
            </p>
            <div className="pt-2 border-t border-border">
              <a href="/portale" className="text-sm text-sky-600 hover:underline font-medium">
                🎿 Accesso Atleti / Genitori
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
