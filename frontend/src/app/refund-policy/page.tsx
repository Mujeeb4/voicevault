'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ChevronLeft, FileText } from 'lucide-react';

const LAST_UPDATED = 'November 22, 2026';

const SECTIONS = [
 { id: 'guarantee', title: "30-Day Guarantee" },
 { id: 'how', title: "How to Request a Refund" },
 { id: 'credits', title: "Question Credits" },
 { id: 'your-rights', title: "Your Legal Rights" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-l-2 border-primary/20 pl-4 sm:pl-5">
      <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-sm leading-[1.75] text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function RefundPolicyPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <OnboardingHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <Link
          href="/"
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
          <aside className="shrink-0 lg:order-1 lg:w-52 lg:pt-24">
            <div className="overflow-x-auto pb-2 lg:sticky lg:top-24 lg:overflow-visible lg:pb-0">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </p>
              <nav aria-label="Terms of service sections">
                <ul className="flex flex-wrap gap-x-3 gap-y-1 lg:flex-col lg:gap-x-0 lg:space-y-1">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`inline-block rounded-md py-3 pl-0 pr-3 text-sm lg:py-1.5 transition-colors sm:text-sm lg:block lg:pl-2 ${
                          activeSection === s.id
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>

          <article className="min-w-0 flex-1 lg:max-w-3xl lg:pt-24">
            <motion.header
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Refund Policy
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
                </div>
              </div>
            </motion.header>

            <div className="space-y-10 sm:space-y-12">
<Section id="guarantee" title="30-Day Guarantee">
              <p>If VoiceVault Premium is not right for you, you can ask for a full refund within 30 days of the date you bought it. No long explanation is needed.</p>

              </Section>
              <Section id="how" title="How to Request a Refund">
              <p>Email <a href="mailto:Info@voicevault.life" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Info@voicevault.life</a> from your account email with the word “Refund” in the subject. We confirm within 2 business days and send the refund to your original payment method. Your bank may take 5 to 10 business days to show it. After a refund, Premium features, including your voice model, are turned off. Your free account and recordings stay unless you ask us to delete them.</p>

              </Section>
              <Section id="credits" title="Question Credits">
              <p>Question credits that you have already used are not refundable. Unused credits bought within the last 30 days can be refunded on request.</p>

              </Section>
              <Section id="your-rights" title="Your Legal Rights">
              <p>This policy is in addition to, and does not limit, any rights you have under consumer protection laws where you live, including cooling-off or cancellation rights that apply to online purchases.</p>

              </Section>
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
