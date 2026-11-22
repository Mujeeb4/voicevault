'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ChevronLeft, FileText } from 'lucide-react';

const LAST_UPDATED = 'November 22, 2026';

const SECTIONS = [
 { id: 'agreement', title: "Agreement to Terms" },
 { id: 'eligibility', title: "Eligibility" },
 { id: 'account', title: "Account Registration" },
 { id: 'services', title: "Services" },
 { id: 'ai-nature', title: "AI-Generated Content" },
 { id: 'voice-rules', title: "Voice Cloning Rules" },
 { id: 'family', title: "Family Members" },
 { id: 'legacy', title: "After Death or Incapacity" },
 { id: 'content', title: "Content & Recordings" },
 { id: 'payment', title: "Plans, Payment & Refunds" },
 { id: 'intellectual-property', title: "Intellectual Property" },
 { id: 'prohibited', title: "Prohibited Conduct" },
 { id: 'disclaimers', title: "Disclaimers" },
 { id: 'limitation', title: "Limitation of Liability" },
 { id: 'indemnification', title: "Indemnification" },
 { id: 'termination', title: "Termination" },
 { id: 'disputes', title: "Dispute Resolution" },
 { id: 'governing-law', title: "Governing Law" },
 { id: 'changes', title: "Changes" },
 { id: 'electronic', title: "Electronic Communications" },
 { id: 'accessibility', title: "Accessibility" },
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
                    Terms of Service
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
                </div>
              </div>
            </motion.header>

            <div className="space-y-10 sm:space-y-12">
<Section id="agreement" title="Agreement to Terms">
              <p>These Terms of Service (“Terms”) govern your use of VoiceVault (“we”, “us”, “our”) and our AI voice preservation service. By creating an account, recording your voice, or using the service, you agree to these Terms and our <a href="/privacy" className="font-medium text-primary underline">Privacy Policy</a>. If you do not agree, do not use VoiceVault.</p>

              </Section>
              <Section id="eligibility" title="Eligibility">
              <p>You must be at least 18 years old and able to form a binding contract to use VoiceVault, whether as a vault owner or as an invited family member. VoiceVault is not for children. If we learn that someone under 18 is using the service, we may close the account.</p>

              </Section>
              <Section id="account" title="Account Registration">
              <p>Provide accurate information and keep it current. You are responsible for your password and for activity under your account. Tell us promptly at the contact address below if you suspect unauthorized use.</p>

              </Section>
              <Section id="services" title="Services">
              <p>VoiceVault provides:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Guided questions and voice recording tools.</li>
                <li>AI transcription and personality analysis of your answers.</li>
                <li>With Premium and your explicit consent, a digital voice model made from your recordings.</li>
                <li>An AI chat in which family members you invite can talk with an AI recreation of you, in text and, with Premium, in an AI-generated voice.</li>
                <li>Family invitation and access tools.</li>
                <li>A free Memory Starter plan and an optional one-time Premium upgrade.</li>
              </ul><p>We may change or discontinue features. If we discontinue the service we will give reasonable notice and a way to download or delete your data where practical.</p>

              </Section>
              <Section id="ai-nature" title="AI-Generated Content">
              <ul className="list-disc space-y-2 pl-5">
                <li>Every reply in VoiceVault is generated by artificial intelligence. It is not the real person, and it is not a living or deceased person speaking.</li>
                <li>Replies are based on what you recorded and on general AI language skills. They can be inaccurate, incomplete or say things the person never said. Do not rely on them as facts.</li>
                <li>VoiceVault is not therapy, counselling, grief treatment, or medical, legal or financial advice. If you are struggling, contact a qualified professional. In the United States or Canada you can call or text 988 at any time for the Suicide and Crisis Lifeline, or call 911 in an emergency.</li>
                <li>You agree not to present AI replies or AI-generated audio as real recordings of a real person, or use them to deceive anyone.</li>
              </ul>
              </Section>
              <Section id="voice-rules" title="Voice Cloning Rules">
              <ul className="list-disc space-y-2 pl-5">
                <li>You may create a voice model only from your own voice. You confirm this each time we ask for your consent.</li>
                <li>You may not upload, record or clone another person’s voice, a public figure’s voice, or a minor’s voice, with or without that person’s permission.</li>
                <li>We create a voice model only after your separate, explicit consent. You may withdraw it at any time by deleting your account or emailing us.</li>
                <li>We may refuse, suspend or remove a voice model if we suspect misuse, impersonation or fraud.</li>
                <li>Do not use a voice model for fraud, harassment, political deception, impersonation, or anything illegal.</li>
              </ul>
              </Section>
              <Section id="family" title="Family Members">
              <p>Vault owners may invite adults to chat with their AI. The owner confirms that each invitee is 18 or older and knows they are talking with an AI. Invitees confirm the same when they accept. Owners can remove access at any time. Invitees may use the chat only for personal, non-commercial purposes and may not record, resell or publish AI-generated audio to mislead others.</p>

              </Section>
              <Section id="legacy" title="After Death or Incapacity">
              <p>Your vault is personal to you. If you pass away or lose capacity, your executor, estate or legal representative may email us with proof of authority to ask us to delete your vault, recordings and voice model. Until then, family members you invited keep their access unless you removed it. We will not create new voice models of you after your death.</p>

              </Section>
              <Section id="content" title="Content & Recordings">
              <p>You keep ownership of your recordings and content. You give us a limited, worldwide, royalty-free licence to store, process and use them only to provide VoiceVault to you and the family you invite, including transcription, personality analysis, voice modelling and AI chat. We do not use your content to train general AI models, to advertise, or for any other purpose. You confirm that you have the right to submit your content and that it contains only your own voice and does not include other people’s private information that you have no right to share.</p>

              </Section>
              <Section id="payment" title="Plans, Payment & Refunds">
              <p>Memory Starter is free within the limits on our pricing page. VoiceVault Premium is a one-time purchase for lifetime access to Premium features for one vault. There is no recurring subscription. Prices are shown in your checkout currency and taxes are added where required.</p>
              <p><strong>30-day money-back guarantee.</strong> If Premium is not right for you, email us within 30 days of purchase and we will refund the purchase price to your original payment method. See our <a href="/refund-policy" className="font-medium text-primary underline">Refund Policy</a>. Where your local law gives you greater rights, those rights apply.</p>
              <p>Each family member of a Premium vault, including the owner, can ask the AI the number of included questions shown on our pricing page. Further questions need question credits, which each family member buys for themselves. One credit covers one question and its answer in text and voice. Credits apply only to the vault they were bought for, do not expire while that vault remains active, have no cash value and, once used, are non-refundable except as required by law.</p>
              <p>We may change prices or plan limits going forward. A later price change will not create a recurring charge for a completed one-time Premium purchase.</p>

              </Section>
              <Section id="intellectual-property" title="Intellectual Property">
              <p>VoiceVault, our logo, and our technology belong to us or our licensors. You may not copy, modify, distribute or create derivative works from our platform without written permission.</p>

              </Section>
              <Section id="prohibited" title="Prohibited Conduct">
              <p>You may not:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Break the law or infringe others’ rights, including privacy and publicity rights.</li>
                <li>Create content that is defamatory, harassing, hateful, sexual involving minors, or otherwise illegal.</li>
                <li>Impersonate anyone, or misrepresent your identity or whose voice is being used.</li>
                <li>Use the service to create deepfakes, fraud, scams or political or commercial deception.</li>
                <li>Reverse engineer, scrape, resell or circumvent our security.</li>
                <li>Interfere with the service or access other people’s accounts.</li>
              </ul>
              </Section>
              <Section id="disclaimers" title="Disclaimers">
              <p>VoiceVault is provided “as is” and “as available”. To the extent the law allows, we disclaim all warranties, including merchantability and fitness for a particular purpose. We do not promise the service will be uninterrupted, error-free or secure, or that AI output will be accurate, complete or appropriate. Nothing here limits rights you have under consumer protection laws that cannot be waived.</p>

              </Section>
              <Section id="limitation" title="Limitation of Liability">
              <p>To the extent the law allows, VoiceVault and its affiliates, officers and employees are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or goodwill, and our total liability for any claim is limited to the amount you paid us in the 12 months before the claim. These limits do not apply to liability that cannot be limited by law, including for fraud, gross negligence or willful misconduct, or where your local law does not allow them.</p>

              </Section>
              <Section id="indemnification" title="Indemnification">
              <p>You agree to defend and reimburse us for claims, losses and reasonable legal costs that result from your breach of these Terms, including cloning a voice that is not your own, or from your unlawful use of the service. This does not apply where the law does not allow it.</p>

              </Section>
              <Section id="termination" title="Termination">
              <p>You may delete your account at any time in Settings. We may suspend or end your access for breach of these Terms, suspected misuse, or where the law requires, and will tell you why where we can. When your account ends, your right to use VoiceVault stops. We delete your data as described in our Privacy Policy, except records we must keep by law.</p>

              </Section>
              <Section id="disputes" title="Dispute Resolution">
              <p>Please contact us first so we can try to resolve any issue informally within 30 days. If we cannot, and where the law allows, disputes will be resolved by binding individual arbitration instead of court, except that either of us may bring an individual claim in small-claims court. You may opt out of arbitration within 30 days of first accepting these Terms by emailing us. Class actions and representative proceedings are waived to the extent the law allows. Nothing in this section limits rights you cannot waive under the consumer protection law where you live, including the right of consumers in Canada to bring a claim in their home province.</p>

              </Section>
              <Section id="governing-law" title="Governing Law">
              <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law rules, except that mandatory consumer protection laws where you live still apply to you. Subject to the Dispute Resolution section, courts in Delaware have jurisdiction, but this does not stop you from bringing a claim where the law gives you the right to do so in your home jurisdiction.</p>

              </Section>
              <Section id="changes" title="Changes">
              <p>We may update these Terms. For material changes we will give you at least 30 days’ notice by email or in the app before they apply to you. If you do not agree, you can stop using VoiceVault and delete your account before the change applies. A change that affects how we use your voice will need your fresh consent.</p>

              </Section>
              <Section id="electronic" title="Electronic Communications">
              <p>You agree to receive notices, receipts and legal messages from us electronically at the email you gave us, and that electronic acceptance and signatures are as effective as paper. Marketing emails are sent only with your consent and you can unsubscribe at any time.</p>

              </Section>
              <Section id="accessibility" title="Accessibility">
              <p>We want VoiceVault to be usable by everyone, including people who use assistive technology. If you have difficulty using any part of the service, email us at <a href="mailto:Info@voicevault.life" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Info@voicevault.life</a> and we will help.</p>

              </Section>
              <Section id="contact" title="Contact Us">
              <p>Questions about these Terms? Email <a href="mailto:Info@voicevault.life" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">Info@voicevault.life</a>.</p>

              </Section>
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
