// Modal for creating a new skill

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../utils/api';

interface CreateSkillModalProps {
    onClose: () => void;
    onCreated: () => void;
}

export function CreateSkillModal({ onClose, onCreated }: CreateSkillModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isValidName = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
    const canSubmit = name.length > 0 && isValidName && description.length > 0 && !isCreating;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setIsCreating(true);
        setError(null);

        try {
            const res = await apiFetch('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, instructions }),
            });

            if (res.ok) {
                onCreated();
            } else {
                const data = await res.json();
                setError(data.error || t('skills.failedToCreate'));
            }
        } catch (e) {
            setError(t('skills.failedToCreate'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal skill-modal">
                <div className="modal-header">
                    <h2>{t('skills.createSkill')}</h2>
                    <button onClick={onClose} className="modal-close">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="skill-form">
                    <div className="form-group">
                        <label htmlFor="skill-name">{t('skills.name')}</label>
                        <input
                            id="skill-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                            placeholder={t('skills.namePlaceholder')}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="skill-description">{t('skills.description')}</label>
                        <input
                            id="skill-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('skills.descriptionPlaceholder')}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="skill-instructions">{t('skills.instructions')}</label>
                        <textarea
                            id="skill-instructions"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder={t('skills.instructionsPlaceholder')}
                            rows={6}
                        />
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            {t('common.cancel')}
                        </button>
                        <button type="submit" disabled={!canSubmit} className="btn-primary">
                            {isCreating ? (
                                <>
                                    <Loader2 size={16} className="spinning" />
                                    <span>{t('skills.creating')}</span>
                                </>
                            ) : (
                                t('skills.createSkill')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
