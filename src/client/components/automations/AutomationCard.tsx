// Individual automation card for automations page gallery

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import { ChevronRight, Clock, Calendar, AlertCircle } from 'lucide-react';
import type { AutomationInfo, AutomationPendingConfirmation } from '../../types/automations';

interface AutomationCardProps {
    automation: AutomationInfo;
    pendingConfirmation?: AutomationPendingConfirmation;
    onClick?: () => void;
}

// Parse cron schedule to human-readable format
function formatSchedule(automation: AutomationInfo, t: TFunction): string {
    if (!automation.triggerType || !automation.triggerConfig) {
        return t('automations.manualOnly');
    }

    if (automation.triggerType !== 'cron') {
        return t('automations.fileWatchTrigger');
    }

    const config = automation.triggerConfig;
    if (config.type !== 'cron') return t('automations.unknownSchedule');

    const parts = config.schedule.split(' ');
    if (parts.length !== 5) return config.schedule;

    const minute = parts[0] ?? '0';
    const hour = parts[1] ?? '0';
    const dayOfMonth = parts[2] ?? '*';
    const dayOfWeek = parts[4] ?? '*';

    const hourNum = parseInt(hour, 10);
    const formatTime = (h: number, m: string) => {
        const am = t('automations.timePeriodAM');
        const pm = t('automations.timePeriodPM');
        // If locale has no AM/PM strings, use 24-hour format
        if (!am && !pm) return `${h.toString().padStart(2, '0')}:${m.padStart(2, '0')}`;
        const h12 = h % 12 || 12;
        return `${h12}:${m.padStart(2, '0')} ${h < 12 ? am : pm}`;
    };
    const timeStr = formatTime(hourNum, minute);

    // Hourly
    if (hour === '*') {
        return t('automations.hourlyAt', { minute: minute.padStart(2, '0') });
    }

    // Daily
    if (dayOfMonth === '*' && dayOfWeek === '*') {
        return t('automations.dailyAt', { time: timeStr });
    }

    // Weekly
    if (dayOfMonth === '*' && dayOfWeek !== '*') {
        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayKeys[parseInt(dayOfWeek, 10)] ?? 'sunday';
        const dayName = t(`automations.days.${dayKey}`);
        return t('automations.weeklyOn', { day: dayName, time: timeStr });
    }

    // Monthly
    if (dayOfMonth !== '*') {
        const dom = parseInt(dayOfMonth, 10);
        let dayStr = `${dom}`;
        if (i18n.language.startsWith('en')) {
            const suffixes = ['th', 'st', 'nd', 'rd'];
            const v = dom % 100;
            dayStr = `${dom}${suffixes[(v >= 11 && v <= 13) ? 0 : Math.min(v % 10, 4) > 3 ? 0 : v % 10]}`;
        }
        return t('automations.monthlyOn', { day: dayStr, time: timeStr });
    }

    return config.schedule;
}

// Format next scheduled time
function formatNextRun(nextScheduledAt: string | undefined, t: TFunction): string | null {
    if (!nextScheduledAt) return null;

    const next = new Date(nextScheduledAt);
    const now = new Date();
    const diffMs = next.getTime() - now.getTime();

    if (diffMs < 0) return t('automations.overdue');

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return t('automations.inDays', { count: diffDays });
    }
    if (diffHours > 0) {
        return t('automations.inHours', { count: diffHours });
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
        return t('automations.inMinutes', { count: diffMinutes });
    }

    return t('automations.soon');
}

const STATUS_KEYS: Record<string, string> = {
    active: 'automations.statusActive',
    paused: 'automations.statusPaused',
};

export function AutomationCard({ automation, pendingConfirmation, onClick }: AutomationCardProps) {
    const { t } = useTranslation();
    const isActive = automation.status === 'active';
    const isPaused = automation.status === 'paused';
    const hasConfirmation = !!pendingConfirmation;
    const hasSchedule = automation.triggerType && automation.triggerConfig;
    const schedule = formatSchedule(automation, t);
    const nextRun = hasSchedule ? formatNextRun(automation.nextScheduledAt, t) : null;

    // Determine card classes
    const cardClasses = [
        'automation-card',
        isPaused ? 'paused' : '',
        hasConfirmation ? 'awaiting-confirmation' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={cardClasses}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            <div className="automation-card-header">
                {hasConfirmation ? (
                    <div className="automation-status-badge awaiting-confirmation">
                        <AlertCircle size={10} />
                        {t('automations.needsApproval')}
                    </div>
                ) : (
                    <div className={`automation-status-badge ${automation.status}`}>
                        {t(STATUS_KEYS[automation.status] ?? 'automations.statusActive', { defaultValue: automation.status })}
                    </div>
                )}
            </div>

            <h3 className="automation-card-title">{automation.name}</h3>

            {automation.description && (
                <p className="automation-card-description">{automation.description}</p>
            )}

            <p className="automation-card-prompt">{automation.prompt}</p>

            <div className="automation-card-footer">
                <div className="automation-schedule">
                    <Calendar size={12} />
                    <span>{schedule}</span>
                </div>
                {nextRun && isActive && !hasConfirmation && (
                    <div className="automation-next-run">
                        <Clock size={12} />
                        <span>{t('automations.next')} {nextRun}</span>
                    </div>
                )}
                <ChevronRight size={14} className="automation-chevron" />
            </div>
        </div>
    );
}
