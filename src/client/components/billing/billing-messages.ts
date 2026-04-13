// Pool of friendly billing messages for chat thread display

import i18n from '../../i18n';
import type { BillingAlertCode } from '../../types/billing';

/**
 * Get a random friendly message for the given billing error code.
 */
export function getRandomBillingMessage(code: BillingAlertCode): string {
    const key = code === 'insufficient_credits'
        ? 'billing.insufficientCredits.messages'
        : 'billing.spendLimit.messages';

    const messages = i18n.t(key, { returnObjects: true }) as string[];
    const index = Math.floor(Math.random() * messages.length);
    // Array always has at least one element, non-null assertion is safe
    return messages[index]!;
}

/**
 * Get the action button label for the given billing error code.
 */
export function getBillingActionLabel(code: BillingAlertCode): string {
    return code === 'insufficient_credits'
        ? i18n.t('billing.insufficientCredits.action')
        : i18n.t('billing.spendLimit.action');
}

/**
 * Get the title for the given billing error code.
 */
export function getBillingTitle(code: BillingAlertCode): string {
    return code === 'insufficient_credits'
        ? i18n.t('billing.insufficientCredits.title')
        : i18n.t('billing.spendLimit.title');
}
