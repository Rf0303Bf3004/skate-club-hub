import React, { useEffect } from "react";
import { Snowflake, ArrowRight } from "lucide-react";

const LandingPage: React.FC = () => {
  useEffect(() => {
    document.title = "Ice Arena — Entra nel tuo club";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Accedi al tuo club di pattinaggio: calendario, eventi, fatture e novità in un solo posto."
    );
  }, []);

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center p-6 bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-700 overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[32rem] h-[32rem] rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-sky-200 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl text-center space-y-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-white/95 text-indigo-600 flex items-center justify-center shadow-2xl">
            <Snowflake className="w-12 h-12" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
            Ice Arena
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-md">
            Il tuo club di pattinaggio, sempre con te.
          </p>
        </div>

        <a
          href="/mio-club"
          className="group inline-flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-6 rounded-2xl bg-white text-indigo-700 text-xl font-bold shadow-2xl hover:scale-[1.02] transition-all"
        >
          Entra nel club
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </a>

        <div className="pt-6">
          <a
            href="/staff"
            className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
          >
            Accesso staff →
          </a>
        </div>
      </div>
    </main>
  );
};

export default LandingPage;
