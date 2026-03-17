import { useI18n } from "@/lib/i18n";

const Index = () => {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
    </div>
  );
};

export default Index;
