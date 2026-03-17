import React, { useState } from 'react';
import { useI18n, LOCALE_LABELS, Locale } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Mail, Globe } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { t, locale, set_locale } = useI18n();
  const { login } = useAuth();
  const [email, set_email] = useState('');
  const [password, set_password] = useState('');

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email || 'demo@demo.ch', password || 'demo');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card rounded-xl shadow-card p-8 space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl tracking-tight">C</span>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">CPA Manager</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('benvenuto')}</p>
            </div>
          </div>

          {/* Language selector */}
          <div className="flex justify-center">
            <Select value={locale} onValueChange={(v) => set_locale(v as Locale)}>
              <SelectTrigger className="w-48">
                <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                  <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form */}
          <form onSubmit={handle_submit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t('email')}
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
                  placeholder={t('password')}
                  value={password}
                  onChange={(e) => set_password(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              {t('accedi')}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">{t('demo_text')}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
