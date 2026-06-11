'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ChevronLeft, FileText } from 'lucide-react';

const LAST_UPDATED = 'February 15, 2026';

const SECTIONS = [
  { id: 'agreement', title: 'Agreement to Terms' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'account', title: 'Account Registration' },
  { id: 'services', title: 'Services' },
  { id: 'user-obligations', title: 'Your Obligations' },
  { id: 'content', title: 'Content & Recordings' },
  { id: 'payment', title: 'Payment & Subscriptions' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'prohibited', title: 'Prohibited Conduct' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'limitation', title: 'Limitation of Liability' },
  { id: 'indemnification', title: 'Indemnification' },
  { id: 'termination', title: 'Termination' },
  { id: 'disputes', title: 'Dispute Resolution' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'changes', title: 'Changes' },
  { id: 'contact', title: 'Contact Us' },
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

export default function TermsPage() {
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
    <div className="min-h-screen bg-background">
      <OnboardingHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
          <aside className="shrink-0 lg:order-1 lg:w-52 lg:pt-24">
            <div className="overflow-x-auto pb-2 lg:sticky lg:top-24 lg:overflow-visible lg:pb-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </p>
              <nav aria-label="Terms of service sections">
                <ul className="flex flex-wrap gap-x-3 gap-y-1 lg:flex-col lg:gap-x-0 lg:space-y-1">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`inline-block rounded-md py-1.5 pl-0 pr-2 text-[13px] transition-colors sm:text-sm lg:block lg:pl-2 ${
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Terms of Service
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last updated: {LAST_UPDATED}
                  </p>
                </div>
              </div>
            </motion.header>

            <div className="space-y-10 sm:space-y-12">
              <Section id="agreement" title="Agreement to Terms">
                <p>
                  These Terms of Service (&quot;Terms&quot;) govern your use of VoiceVault (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) and our AI voice preservation platform. By creating an account, recording your voice, or otherwise accessing our services, you agree to be bound by these Terms. If you do not agree, you may not use VoiceVault.
                </p>
              </Section>

              <Section id="eligibility" title="Eligibility">
                <p>You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use VoiceVault. By using our services, you represent and warrant that you meet these requirements. Users under 18 may only use VoiceVault with parental or guardian consent and supervision.</p>
              </Section>

              <Section id="account" title="Account Registration">
                <p>You must create an account to use our services. You agree to provide accurate, current, and complete information and to update it as needed. You are responsible for maintaining the confidentiality of your password and for all activity under your account. You must notify us promptly of any unauthorized use.</p>
              </Section>

              <Section id="services" title="Services">
                <p>VoiceVault provides:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Voice recording tools to capture answers to life story questions</li>
                  <li>AI-powered transcription, personality analysis, and voice cloning</li>
                  <li>An AI chat feature allowing invited family members to interact with your cloned voice</li>
                  <li>Family invitation and access management</li>
                  <li>Subscription-based access tiers (Lite, Premium, Family)</li>
                </ul>
                <p>We reserve the right to modify, suspend, or discontinue any part of our services at any time with reasonable notice where practicable.</p>
              </Section>

              <Section id="user-obligations" title="Your Obligations">
                <p>You agree to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Use VoiceVault only for lawful purposes and in accordance with these Terms</li>
                  <li>Provide content (including voice recordings) that you own or have the right to use</li>
                  <li>Not impersonate others or misrepresent your identity</li>
                  <li>Not attempt to gain unauthorized access to our systems or other accounts</li>
                  <li>Not use our services to harm, harass, or abuse others</li>
                  <li>Comply with all applicable laws and regulations</li>
                </ul>
              </Section>

              <Section id="content" title="Content & Recordings">
                <p>You retain ownership of your voice recordings and other content you submit. By using VoiceVault, you grant us a limited, worldwide, royalty-free license to store, process, and use your content solely to provide our services (including transcription, personality analysis, voice cloning, and AI chat). We do not claim ownership of your content and will not use it for purposes beyond delivering VoiceVault services.</p>
              </Section>

              <Section id="payment" title="Payment & Subscriptions">
                <p>Paid plans are billed in advance. Fees are non-refundable except as required by law or as explicitly stated in our refund policy. You may cancel your subscription at any time; cancellation will take effect at the end of the current billing period. We may change our pricing with reasonable notice. Continued use after a price change constitutes acceptance.</p>
              </Section>

              <Section id="intellectual-property" title="Intellectual Property">
                <p>VoiceVault, our logo, and our technology are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works based on our platform without our prior written consent. Our trademarks and trade dress may not be used without permission.</p>
              </Section>

              <Section id="prohibited" title="Prohibited Conduct">
                <p>You may not:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Use VoiceVault to create content that infringes others&apos; rights, is defamatory, or illegal</li>
                  <li>Reverse engineer, decompile, or attempt to extract our source code</li>
                  <li>Use automated means to scrape or access our services without permission</li>
                  <li>Resell or redistribute our services without authorization</li>
                  <li>Circumvent any access controls or security measures</li>
                </ul>
              </Section>

              <Section id="disclaimers" title="Disclaimers">
                <p>VoiceVault is provided &quot;as is&quot; and &quot;as available.&quot; We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not warrant that our services will be uninterrupted, error-free, or secure. AI-generated outputs may not always be accurate or appropriate.</p>
              </Section>

              <Section id="limitation" title="Limitation of Liability">
                <p>To the maximum extent permitted by law, VoiceVault and its affiliates, officers, directors, and employees shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from your use of our services. Our total liability shall not exceed the amount you paid us in the twelve (12) months preceding the claim. Some jurisdictions do not allow these limitations; in such cases, our liability will be limited to the fullest extent permitted by law.</p>
              </Section>

              <Section id="indemnification" title="Indemnification">
                <p>You agree to indemnify, defend, and hold harmless VoiceVault and its affiliates from and against any claims, losses, damages, liabilities, and expenses (including reasonable attorneys&apos; fees) arising from your use of our services, your content, or your violation of these Terms.</p>
              </Section>

              <Section id="termination" title="Termination">
                <p>We may suspend or terminate your account and access to our services at any time for any reason, including violation of these Terms. You may terminate your account at any time from your settings. Upon termination, your right to use VoiceVault ceases. We may retain certain data as required by law or for legitimate business purposes.</p>
              </Section>

              <Section id="disputes" title="Dispute Resolution">
                <p>Any dispute arising from these Terms or our services shall first be addressed through good-faith negotiation. If we cannot resolve the dispute within 30 days, either party may pursue binding arbitration in accordance with applicable rules, except where prohibited by law. Class actions and representative proceedings are waived to the extent permitted.</p>
              </Section>

              <Section id="governing-law" title="Governing Law">
                <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any legal action shall be brought in the courts located in Delaware.</p>
              </Section>

              <Section id="changes" title="Changes">
                <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of VoiceVault after changes constitutes acceptance of the updated Terms. If you do not agree, you must stop using our services.</p>
              </Section>

              <Section id="contact" title="Contact Us">
                <p>
                  Questions about these Terms? Contact us at{' '}
                  <a
                    href="mailto:Info@voicevault.life"
                    className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                  >
                    Info@voicevault.life
                  </a>
                </p>
                <p>VoiceVault · Preserving your voice for the people who matter most.</p>
              </Section>
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
