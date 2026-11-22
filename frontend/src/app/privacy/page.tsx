'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ChevronLeft, Shield } from 'lucide-react';

const LAST_UPDATED = 'November 22, 2026';

const SECTIONS = [
 { id: 'introduction', title: "Introduction" },
 { id: 'information-we-collect', title: "Information We Collect" },
 { id: 'how-we-use', title: "How We Use Your Information" },
 { id: 'voice-recordings', title: "Voice Recordings, Voice Models & AI" },
 { id: 'retention', title: "Retention & Deletion" },
 { id: 'family-sharing', title: "Sharing with Family" },
 { id: 'third-parties', title: "Service Providers & Sharing" },
 { id: 'cookies', title: "Cookies & Tracking" },
 { id: 'your-rights', title: "Your Privacy Rights" },
 { id: 'security', title: "Security & Breach Notice" },
 { id: 'children', title: "Children" },
 { id: 'international', title: "Where Data Is Processed" },
 { id: 'changes', title: "Changes to This Policy" },
 { id: 'contact', title: "Contact Us" },
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
    <div className="min-h-dvh bg-background">
      <OnboardingHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
          {/* Table of contents — horizontal on mobile, sticky sidebar on desktop */}
          <aside className="shrink-0 lg:order-1 lg:w-52 lg:pt-24">
            <div className="overflow-x-auto pb-2 lg:sticky lg:top-24 lg:overflow-visible lg:pb-0">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </p>
              <nav aria-label="Privacy policy sections">
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

          {/* Content */}
          <article className="min-w-0 flex-1 lg:max-w-3xl lg:pt-24">
            <motion.header
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Privacy Policy
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
                </div>
              </div>
            </motion.header>

            <div className="space-y-10 sm:space-y-12">
<Section id="introduction" title="Introduction">
              <p>VoiceVault (“we”, “our”, “us”) helps you preserve your voice and stories so the family members you choose can talk with an AI recreation of you. This Privacy Policy explains what we collect, why, who sees it, how long we keep it, and the choices you have. It applies to our website and services in the United States and Canada.</p>
              <p>VoiceVault is for adults aged 18 and over. Your voice is personal and sensitive, so we ask for your clear consent before we record it or create a voice model from it.</p>

              </Section>
              <Section id="information-we-collect" title="Information We Collect">
              <h3 className="mt-4 font-medium text-foreground">Account information</h3>
              <p>Your name, email address, phone number (if you give one), and password (stored in hashed form). If you are invited by family, we also hold your name, email and relationship to the vault owner.</p>
              <h3 className="mt-4 font-medium text-foreground">Voice recordings and transcripts</h3>
              <p>The audio of your answers to our guided questions, and the written transcripts of that audio.</p>
              <h3 className="mt-4 font-medium text-foreground">Personality profile</h3>
              <p>An AI-generated summary of your personality, values, communication style and life facts, produced from your transcripts.</p>
              <h3 className="mt-4 font-medium text-foreground">Voice model (voiceprint)</h3>
              <p>If you choose Premium and consent, we create a digital model of your voice from your recordings. A voice model can identify you, so we treat it as biometric and sensitive data.</p>
              <h3 className="mt-4 font-medium text-foreground">Conversations</h3>
              <p>The questions family members ask your AI, the AI’s replies, and any audio generated for those replies.</p>
              <h3 className="mt-4 font-medium text-foreground">Payment information</h3>
              <p>Payments are handled by a third-party payment processor. We do not see or store your full card number. We receive your card brand, the last four digits, the amount and a transaction reference.</p>
              <h3 className="mt-4 font-medium text-foreground">Usage and device data</h3>
              <p>Pages visited, features used, browser and device type, approximate location from your IP address, and security logs. Advertising and analytics measurement happens only if you accept cookies (see Cookies & Tracking).</p>

              </Section>
              <Section id="how-we-use" title="How We Use Your Information">
              <p>We use your information to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Create your account and provide the VoiceVault service.</li>
                <li>Transcribe your recordings and build your AI personality profile.</li>
                <li>Create and use your voice model, only with your consent, to speak AI replies to the family members you invite.</li>
                <li>Let invited family members chat with your AI recreation.</li>
                <li>Process payments, issue refunds and manage your plan.</li>
                <li>Send service messages such as verification, receipts and security alerts.</li>
                <li>Prevent fraud and abuse, keep the service secure, and comply with law.</li>
                <li>Measure and improve our site and ads, only if you accept cookies.</li>
              </ul><p>We do not use your recordings, transcripts, voice model or conversations to advertise to you or others, and we do not sell them.</p>

              </Section>
              <Section id="voice-recordings" title="Voice Recordings, Voice Models & AI">
              <p>Your voice is the core of VoiceVault. Here is exactly how we handle it:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Consent first.</strong> Before your first recording we ask you to confirm you are 18 or older, that it is your own voice, and that you agree to recording and AI processing. Before we create a voice model we ask for a separate, explicit consent that names the voiceprint. We keep a dated record of each consent.</li>
                <li><strong>AI processing.</strong> Your recordings and transcripts are processed by AI services run by our service providers to transcribe speech, build your personality profile, create your voice model and generate AI replies.</li>
                <li><strong>Limited use.</strong> Your voice model and transcripts are used only to power chats for the family members you invite. We do not use them to train general-purpose AI models, we do not sell them, and we do not use them to identify you for any other purpose.</li>
                <li><strong>Your own voice only.</strong> You may create a voice model only from your own voice. Cloning another person’s voice is not allowed.</li>
                <li><strong>Clearly labelled AI.</strong> Replies are AI-generated, are labelled as AI in the product, and are not the real person.</li>
                <li><strong>You stay in control.</strong> You can withdraw voice consent, delete recordings, or delete your account and voice model at any time (see Retention & Deletion).</li>
              </ul><p>Some laws, such as the Illinois Biometric Information Privacy Act and similar laws in Texas and Washington, give extra protections for voiceprints. We follow the strictest of these standards for all users.</p>

              </Section>
              <Section id="retention" title="Retention & Deletion">
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Recordings, transcripts, personality profile, conversations and voice model:</strong> kept while your account is active so the service can work.</li>
                <li><strong>If you delete your account:</strong> we delete these from our systems right away, and we delete your voice model at our voice provider. Backups are overwritten within 30 days.</li>
                <li><strong>If you withdraw voice consent or ask us to delete your voice model or any recording:</strong> email us and we will do it within 30 days. You can also use Record again in the app to replace recordings.</li>
                <li><strong>Inactive accounts:</strong> if you do not sign in for 3 years, we will destroy your voice recordings and voice model.</li>
                <li><strong>Legal records:</strong> payment and tax records are kept as the law requires (generally up to 7 years). Consent records are kept for as long as needed to prove your consent.</li>
              </ul><p>If you pass away, your executor or estate may ask us to delete your vault by emailing us with proof of authority. Until then, the family members you invited keep their access unless you remove it.</p>

              </Section>
              <Section id="family-sharing" title="Sharing with Family">
              <p>You decide who can talk with your AI.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Only adults you invite can chat with your AI and hear its voice replies. Each invitee must confirm they are 18 or older and that they understand they are talking with an AI.</li>
                <li>Invited family members see only the conversations they took part in.</li>
                <li>You can remove a family member’s access at any time from the Family page.</li>
              </ul>
              </Section>
              <Section id="third-parties" title="Service Providers & Sharing">
              <p>We use trusted service providers who process data on our behalf under written contracts, for: payment processing, cloud hosting and file storage, AI transcription and language processing, AI voice generation, email delivery, and (only with your consent) analytics and advertising measurement. They may use your data only to provide services to us, and we configure our accounts so that your voice data is not used to train their general AI models.</p>
              <p>We do not sell your personal information. We do not “share” it for cross-context behavioral advertising except through the optional cookies described below, which are off until you accept them. We may disclose information if required by law, to protect safety and rights, or in a merger or sale of the business (we will tell you and honor these promises).</p>

              </Section>
              <Section id="cookies" title="Cookies & Tracking">
              <p>We use essential cookies to keep you signed in and secure. These cannot be turned off. With your permission only, we also use analytics and advertising measurement tools that set cookies or similar technologies to learn how people find VoiceVault and to measure our ads. When you decline, they do not load. You can change your choice at any time by clearing this site’s data in your browser, which shows the choice banner again. We honor the Global Privacy Control signal as a decline.</p>

              </Section>
              <Section id="your-rights" title="Your Privacy Rights">
              <p>Wherever you live you can ask us to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Access</strong> a copy of your personal data, and know how we use it.</li>
                <li><strong>Correct</strong> inaccurate data.</li>
                <li><strong>Delete</strong> your data, including your voice model.</li>
                <li><strong>Port</strong> your data in a common format.</li>
                <li><strong>Withdraw consent</strong> to recording, voice models or marketing at any time.</li>
                <li><strong>Opt out</strong> of advertising and analytics by declining cookies.</li>
                <li><strong>Not be treated worse</strong> for using these rights.</li>
              </ul><p>Residents of California, Colorado, Connecticut, Texas, Virginia and other US states with privacy laws have these rights under their state law, and may appeal a refusal by emailing us with “Appeal” in the subject. If you are not satisfied, you may contact your state attorney general. Residents of Canada have the rights set out in the Personal Information Protection and Electronic Documents Act (PIPEDA) and may complain to the Office of the Privacy Commissioner of Canada.</p>
              <p>To use any right, email <a href="mailto:Info@voicevault.life" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Info@voicevault.life</a>. We may need to confirm it is you. We respond within 30 days (up to 45 days where the law allows, and we will tell you why).</p>

              </Section>
              <Section id="security" title="Security & Breach Notice">
              <ul className="list-disc space-y-2 pl-5">
                <li>All traffic uses encryption (HTTPS) and stored recordings are protected with encryption and access controls.</li>
                <li>Access to personal data is limited to people and systems that need it to run the service, and is logged.</li>
                <li>If a breach puts your personal data at risk, we will tell you and the authorities as the law requires, without unreasonable delay.</li>
              </ul><p>No system is perfectly secure, so please use a strong, unique password.</p>

              </Section>
              <Section id="children" title="Children">
              <p>VoiceVault is for people aged 18 and over. We do not knowingly collect personal information from anyone under 18. If you believe a child has given us information, email us and we will delete it promptly.</p>

              </Section>
              <Section id="international" title="Where Data Is Processed">
              <p>We and our service providers process data in the United States and Canada. By using VoiceVault you understand your data may be stored and processed in these countries, where laws may differ from those where you live. We use contracts and security measures to protect it.</p>

              </Section>
              <Section id="changes" title="Changes to This Policy">
              <p>If we make a material change, we will tell you by email or in the app before it takes effect. If a change affects how we use your voice, we will ask for your consent again. The “Last updated” date shows the latest version.</p>

              </Section>
              <Section id="contact" title="Contact Us">
              <p>Questions, requests or complaints about privacy: <a href="mailto:Info@voicevault.life" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Info@voicevault.life</a>. Our privacy contact reads every message and will reply within 30 days.</p>
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
