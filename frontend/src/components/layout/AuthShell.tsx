import Link from 'next/link';
import Image from 'next/image';
import { Check, ArrowLeft } from 'lucide-react';

const points = [
  'Answer guided questions at your own pace',
  'Your recordings are encrypted and private',
  'Only the family you invite can talk to your AI',
];

/** Split-screen layout for sign in, sign up and password help. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1fr]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="VoiceVault home">
            <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9" priority />
            <span className="font-logo text-lg font-bold text-foreground">VoiceVault</span>
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="flex items-center justify-between px-4 py-5 text-xs text-muted-foreground sm:px-8">
          <span>© {new Date().getFullYear()} VoiceVault</span>
          <span className="flex gap-1">
            <Link href="/terms" className="flex min-h-11 items-center px-3 hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="flex min-h-11 items-center px-3 hover:text-foreground">Privacy</Link>
          </span>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:items-center lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]"
          aria-hidden
        />
        <div className="relative max-w-md px-10">
          <h2 className="text-4xl font-semibold leading-tight text-balance">Keep your voice for the people who matter.</h2>
          <p className="mt-4 text-primary-foreground/85">
            Record your stories once. Your family can ask questions and hear you answer, for as long as they need.
          </p>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
