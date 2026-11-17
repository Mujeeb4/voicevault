'use client';

/**
 * Questions left for this family member, and buying more as credits.
 * Each family member of a Premium vault gets included questions, then buys credits (1 credit = 1 question).
 * The first purchase saves the card at Stripe, so later refills are one click.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Loader2, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { paymentsApi, type QuestionCredits } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import { cn, getApiErrorMessage } from '@/lib/utils';

const PACK_SIZES = [25, 100, 250];

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function cardLabel(card: { brand: string; last4: string }) {
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  return `${brand} •••• ${card.last4}`;
}

/** Loads the member's remaining questions, and confirms a credit purchase when returning from Stripe. */
export function useQuestionCredits(aiOwnerId: string, refreshKey: unknown) {
  const [credits, setCredits] = useState<QuestionCredits | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('credits_session_id');
  const canceled = searchParams.get('credits') === 'canceled';

  const refresh = useCallback(() => {
    paymentsApi.getQuestionCredits(aiOwnerId).then(setCredits).catch(() => setCredits(null));
  }, [aiOwnerId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!sessionId && !canceled) return;
    router.replace(pathname);
    if (canceled) {
      toast.info('Credit purchase canceled.');
      return;
    }
    paymentsApi
      .confirmCreditCheckout(sessionId!)
      .then(() => {
        // Reload rather than use the response, so the newly saved card shows up too
        refresh();
        toast.success('Credits added. Your card is saved for quick refills.');
      })
      .catch(() => toast.error('We could not confirm your purchase yet. It will appear shortly.'));
  }, [sessionId, canceled, pathname, router, refresh]);

  return { credits, setCredits, refresh };
}

export function QuestionsLeftBadge({
  credits,
  onClick,
}: {
  credits: QuestionCredits | null;
  onClick?: () => void;
}) {
  if (!credits?.is_premium_vault) return null;
  const low = credits.questions_remaining <= 5;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent',
        low ? 'border-destructive/40 text-destructive' : 'border-border text-muted-foreground'
      )}
      title={`${credits.included_questions_remaining} included + ${credits.credit_balance} credits. Click to add more.`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {credits.questions_remaining} questions left
    </button>
  );
}

export function BuyCreditsPanel({
  aiOwnerId,
  aiOwnerName,
  credits,
  onCreditsChange,
  onClose,
}: {
  aiOwnerId: string;
  aiOwnerName: string;
  credits: QuestionCredits | null;
  onCreditsChange: (credits: QuestionCredits) => void;
  /** Shown only when the panel was opened by choice (questions still left) */
  onClose?: () => void;
}) {
  const [loadingSize, setLoadingSize] = useState<number | null>(null);
  const [removingCard, setRemovingCard] = useState(false);
  // "Use a different card": the size buttons go to Checkout instead of charging the saved card
  const [useNewCard, setUseNewCard] = useState(false);
  if (!credits?.can_buy_credits) return null;

  const sizes = PACK_SIZES.filter(
    (size) => size >= credits.credit_min_purchase && size <= credits.credit_max_purchase
  );
  if (!sizes.length) sizes.push(credits.credit_min_purchase);
  const savedCard = credits.saved_card;
  const chargeSavedCard = !!savedCard && !useNewCard;

  const checkout = async (size: number) => {
    const { checkout_url } = await paymentsApi.createCreditCheckoutSession(aiOwnerId, size);
    window.location.href = checkout_url;
  };

  const buy = async (size: number, useSavedCard: boolean) => {
    setLoadingSize(size);
    try {
      if (!useSavedCard) {
        await checkout(size);
        return;
      }
      // A fresh id per click: a retried request never charges the card twice
      const result = await paymentsApi.refillWithSavedCard(aiOwnerId, size, crypto.randomUUID());
      if (result.requires_checkout) {
        toast.info(result.error ?? 'Continuing to secure checkout.');
        await checkout(size);
        return;
      }
      // The refill response has only the counts, so keep the vault and saved-card fields
      if (result.questions) onCreditsChange({ ...credits, ...result.questions });
      toast.success(`${size} questions added to your account.`);
      setLoadingSize(null);
      onClose?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not complete the purchase. Please try again.'));
      setLoadingSize(null);
    }
  };

  const removeCard = async () => {
    setRemovingCard(true);
    try {
      await paymentsApi.removeSavedCard();
      onCreditsChange({ ...credits, saved_card: null });
      toast.success('Saved card removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not remove the card. Please try again.'));
    } finally {
      setRemovingCard(false);
    }
  };

  const outOfQuestions = credits.questions_remaining === 0;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-primary/30 bg-accent p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {outOfQuestions
              ? `You've used your ${credits.included_questions} included questions with ${aiOwnerName}.`
              : `Add more questions for ${aiOwnerName}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Each credit is one question, answered in text and voice.
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {sizes.map((size) => (
          <Button
            key={size}
            size="sm"
            variant={size === sizes[1] ? 'default' : 'outline'}
            disabled={loadingSize !== null}
            onClick={() => buy(size, chargeSavedCard)}
          >
            {loadingSize === size && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {size} questions · {formatPrice(size * credits.credit_unit_price_cents, credits.currency)}
          </Button>
        ))}
      </div>

      {savedCard ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5" />
            {chargeSavedCard ? `Pays with ${cardLabel(savedCard)}` : 'Pays with a new card at checkout'}
          </span>
          <button
            type="button"
            className="underline hover:text-foreground disabled:opacity-50"
            disabled={loadingSize !== null}
            onClick={() => setUseNewCard(!useNewCard)}
          >
            {chargeSavedCard ? 'Use a different card' : `Use ${cardLabel(savedCard)}`}
          </button>
          <button
            type="button"
            className="underline hover:text-foreground disabled:opacity-50"
            disabled={removingCard || loadingSize !== null}
            onClick={removeCard}
          >
            Remove card
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Your card is saved securely with Stripe so next time is one click.
        </p>
      )}
    </div>
  );
}
