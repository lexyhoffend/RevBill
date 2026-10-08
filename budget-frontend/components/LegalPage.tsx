import Link from "next/link";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export type LegalSection = { heading: string; body: React.ReactNode };

// Public (no login required) layout shared by the Terms and Privacy pages.
export default function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Rev<span className="text-emerald-700 dark:text-emerald-400">Bill</span>
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-xs text-slate-400 mt-1">Effective {LEGAL_EFFECTIVE_DATE}</p>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{intro}</div>
      {sections.map((s, i) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-base font-semibold">
            {i + 1}. {s.heading}
          </h2>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            {s.body}
          </div>
        </section>
      ))}
    </main>
  );
}
