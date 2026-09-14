import { Link, useParams, Navigate } from "react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { BRAND } from "@/lib/site";
import { LEGAL_DOCS } from "@/pages/legal/content";

export default function Legal() {
  const { slug } = useParams<{ slug: string }>();
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);

  if (!doc) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen" style={{ background: BRAND.cream, color: BRAND.ink }}>
      <header
        className="sticky top-0 z-10 border-b backdrop-blur"
        style={{ background: `${BRAND.cream}ee`, borderColor: BRAND.sage }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-lg font-bold tracking-wide">
            ЛАВБРЮ
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-70"
            style={{ borderColor: BRAND.ink }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: d.slug === doc.slug ? BRAND.ink : BRAND.white,
                color: d.slug === doc.slug ? BRAND.cream : BRAND.ink,
                border: `1px solid ${BRAND.sage}`,
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              {d.title}
            </Link>
          ))}
        </nav>

        <h1 className="font-display text-3xl font-bold sm:text-4xl">{doc.title}</h1>

        <div className="mt-8 grid gap-8">
          {doc.blocks.map((block, i) => (
            <section key={i}>
              {block.h && (
                <h2 className="font-display text-lg font-bold uppercase tracking-wide" style={{ color: BRAND.sageDeep }}>
                  {block.h}
                </h2>
              )}
              {block.p?.map((para, j) => (
                <p key={j} className="mt-3 leading-relaxed opacity-90">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 border-t pt-6 text-xs opacity-60" style={{ borderColor: BRAND.sage }}>
          <p>© 2026 ЛАВБРЮ · ИП Аветисян Е.С. · ИНН 773119647813 · ОГРНИП 322774600388110</p>
        </div>
      </main>
    </div>
  );
}
