// Empty state when no automations are configured

import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AutomationsEmpty() {
    const { t } = useTranslation();
    return (
        <div className="empty-state automations-empty">
            <Clock className="empty-icon" size={32} strokeWidth={1.5} />
            <h2>{t('automations.noRoutinesTitle')}</h2>
            <p>{t('automations.noRoutinesDescription')}</p>
            <p className="empty-hint">
                {t('automations.noRoutinesHint')}
            </p>
        </div>
    );
}
