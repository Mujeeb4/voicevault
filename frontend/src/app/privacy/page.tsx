'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ChevronLeft, Shield } from 'lucide-react';

const LAST_UPDATED = 'February 15, 2026';

const SECTIONS = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use', title: 'How We Use Your Information' },
  { id: 'voice-recordings', title: 'Voice Recordings & AI' },
  { id: 'data-storage', title: 'Data Storage & Security' },
  { id: 'family-sharing', title: 'Sharing with Family' },
  { id: 'third-parties', title: 'Third-Party Services' },
  { id: 'cookies', title: 'Cookies & Tracking' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'children', title: "Children's Privacy" },
  { id: 'international', title: 'International Transfers' },
  { id: 'changes', title: 'Changes to This Policy' },
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

export default function PrivacyPage() {
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
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
          {/* Table of contents — horizontal on mobile, sticky sidebar on desktop */}
          <aside className="shrink-0 lg:order-1 lg:w-52 lg:pt-24">
            <div className="overflow-x-auto pb-2 lg:sticky lg:top-24 lg:overflow-visible lg:pb-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </p>
              <nav aria-label="Privacy policy sections">
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

          {/* Content */}
          <article className="min-w-0 flex-1 lg:max-w-3xl lg:pt-24">
            <motion.header
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Privacy Policy
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last updated: {LAST_UPDATED}
                  </p>
                </div>
              </div>
            </motion.header>

            <div className="space-y-10 sm:space-y-12">
              <Section id="introduction" title="Introduction">
                <p>
                  Welcome to VoiceVault (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and the privacy of your family&apos;s most precious memories. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI voice memory platform, including our website, applications, and services.
                </p>
                <p>
                  By using VoiceVault, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
                </p>
              </Section>

              <Section id="information-we-collect" title="Information We Collect">
                <p>We collect information that you provide directly to us and information that is automatically collected when you use our services.</p>
                <h3 className="mt-4 font-medium text-foreground">Account Information</h3>
                <p>When you create an account, we collect your name, email address, and password. You may also provide a profile photo and other optional profile details.</p>
                <h3 className="mt-4 font-medium text-foreground">Voice Recordings</h3>
                <p>To create your AI voice memory, you record answers to life story questions. These audio recordings are stored securely and processed by our AI systems for transcription, personality analysis, and voice cloning.</p>
                <h3 className="mt-4 font-medium text-foreground">Payment Information</h3>
                <p>When you subscribe to a plan, payment is processed by Stripe. We do not store your full payment card details; we receive only transaction identifiers and subscription status.</p>
                <h3 className="mt-4 font-medium text-foreground">Usage Data</h3>
                <p>We collect information about how you interact with our services, including pages visited, features used, and device information (browser type, operating system) to improve our platform.</p>
              </Section>

              <Section id="how-we-use" title="How We Use Your Information">
                <p>We use the information we collect to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Provide, maintain, and improve our voice preservation and AI chat services</li>
                  <li>Process your voice recordings for transcription, personality analysis, and voice cloning</li>
                  <li>Enable family members you invite to chat with your AI voice</li>
                  <li>Process payments and manage your subscription</li>
                  <li>Send you service-related communications and support requests</li>
                  <li>Protect against fraud and abuse, and ensure platform security</li>
                  <li>Comply with legal obligations and enforce our terms</li>
                </ul>
              </Section>

              <Section id="voice-recordings" title="Voice Recordings & AI Processing">
                <p>Your voice recordings are the core of VoiceVault. We take extraordinary care with this data:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Recordings are stored in encrypted form and processed only for the purposes of creating your AI voice</li>
                  <li>We use OpenAI Whisper for transcription, OpenAI GPT for personality analysis, and ElevenLabs for voice cloning</li>
                  <li>Your voice model and transcriptions are used solely to power the AI chat feature for your invited family members</li>
                  <li>We do not use your voice or recordings for advertising, training general AI models, or any purpose beyond your VoiceVault experience</li>
                </ul>
              </Section>

              <Section id="data-storage" title="Data Storage & Security">
                <p>We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Data is stored with Supabase (PostgreSQL and Storage) and subject to their security practices</li>
                  <li>Audio files are encrypted at rest; all API traffic uses HTTPS</li>
                  <li>Access to data is restricted to authorized personnel and automated systems required for service delivery</li>
                  <li>We retain your data as long as your account is active; you may request deletion at any time</li>
                </ul>
              </Section>

              <Section id="family-sharing" title="Sharing with Family">
                <p>You control who can access your AI voice. When you invite family members:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Only people you explicitly invite can chat with your AI and hear your cloned voice</li>
                  <li>Family members see conversation history only for chats they have participated in</li>
                  <li>You can revoke access at any time from your family management settings</li>
                </ul>
              </Section>

              <Section id="third-parties" title="Third-Party Services">
                <p>We use the following third-party services. Each has its own privacy policy:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li><strong>Stripe</strong> — Payment processing</li>
                  <li><strong>Supabase</strong> — Database and file storage</li>
                  <li><strong>OpenAI</strong> — Transcription (Whisper) and chat (GPT-4o)</li>
                  <li><strong>ElevenLabs</strong> — Voice cloning and text-to-speech</li>
                </ul>
                <p>We do not sell your personal information to third parties.</p>
              </Section>

              <Section id="cookies" title="Cookies & Tracking">
                <p>We use essential cookies to keep you logged in and to remember your preferences. We may use analytics cookies (with your consent where required) to understand how our site is used and improve the experience. We do not use advertising or cross-site tracking cookies.</p>
              </Section>

              <Section id="your-rights" title="Your Rights">
                <p>Depending on your location, you may have the right to:</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li><strong>Access</strong> — Request a copy of your personal data</li>
                  <li><strong>Correction</strong> — Request correction of inaccurate data</li>
                  <li><strong>Deletion</strong> — Request deletion of your account and associated data</li>
                  <li><strong>Portability</strong> — Request your data in a portable format</li>
                  <li><strong>Withdraw consent</strong> — Where processing is based on consent</li>
                  <li><strong>Object or restrict</strong> — In certain jurisdictions (e.g., GDPR)</li>
                </ul>
                <p>To exercise these rights, contact us at the email below. We will respond within 30 days.</p>
              </Section>

              <Section id="children" title="Children's Privacy">
                <p>VoiceVault is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us and we will delete it promptly.</p>
              </Section>

              <Section id="international" title="International Transfers">
                <p>Your data may be processed in countries other than your country of residence. We ensure appropriate safeguards (such as Standard Contractual Clauses) are in place for transfers outside the EEA and similar regions.</p>
              </Section>

              <Section id="changes" title="Changes to This Policy">
                <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use of VoiceVault after changes constitutes acceptance of the updated policy.</p>
              </Section>

              <Section id="contact" title="Contact Us">
                <p>
                  If you have questions about this Privacy Policy or your data, contact us at:{' '}
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
