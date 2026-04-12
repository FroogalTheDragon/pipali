// Main skills page component

import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SkillInfo, SkillLoadError } from '../../types/skills';
import { SkillCard } from './SkillCard';
import { SkillsEmpty } from './SkillsEmpty';
import { CreateSkillModal } from './CreateSkillModal';
import { SkillDetailModal } from './SkillDetailModal';
import { apiFetch } from '../../utils/api';

export function SkillsPage() {
    const { t } = useTranslation();
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [errors, setErrors] = useState<SkillLoadError[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReloading, setIsReloading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

    useEffect(() => {
        fetchSkills();
    }, []);

    const fetchSkills = async () => {
        try {
            const res = await apiFetch('/api/skills');
            if (res.ok) {
                const data = await res.json();
                setSkills(data.skills || []);
            }
        } catch (e) {
            console.error('Failed to fetch skills', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReload = async () => {
        setIsReloading(true);
        setErrors([]);
        try {
            const res = await apiFetch('/api/skills/reload', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setSkills(data.skills || []);
                setErrors(data.errors || []);
            }
        } catch (e) {
            console.error('Failed to reload skills', e);
        } finally {
            setIsReloading(false);
        }
    };

    const handleSkillCreated = () => {
        setShowCreateModal(false);
        handleReload();
    };

    const handleSkillDeleted = () => {
        setSelectedSkill(null);
        handleReload();
    };

    const handleToggleVisibility = async (skill: SkillInfo, visible: boolean) => {
        try {
            const res = await apiFetch(`/api/skills/${encodeURIComponent(skill.name)}/visibility`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visible }),
            });
            if (res.ok) {
                const data = await res.json();
                setSkills(prev => prev.map(s => s.name === skill.name ? data.skill : s));
            }
        } catch (e) {
            console.error('Failed to toggle skill visibility', e);
        }
    };

    if (isLoading) {
        return (
            <main className="main-content">
                <div className="messages-container">
                    <div className="skills-gallery">
                        <div className="skills-loading">{t('skills.loading')}</div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content">
            <div className="messages-container">
                <div className="skills-gallery">
                    <div className="skills-header">
                        <div className="skills-header-left">
                            <h2>{t('skills.title')}</h2>
                            <span className="skills-count">{skills.length}</span>
                        </div>
                        <div className="skills-header-actions">
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="skills-create-btn"
                            >
                                <Plus size={16} />
                                <span>{t('common.create')}</span>
                            </button>
                            <button
                                onClick={handleReload}
                                disabled={isReloading}
                                className="skills-reload-btn"
                                title={t('skills.reloadTooltip')}
                            >
                                <RefreshCw size={16} className={isReloading ? 'spinning' : ''} />
                            </button>
                        </div>
                    </div>

                    {errors.length > 0 && (
                        <div className="skills-errors">
                            {errors.map((error, i) => (
                                <div key={i} className="skills-error">
                                    <AlertCircle size={14} />
                                    <span>{error.path}: {error.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {skills.length === 0 ? (
                        <SkillsEmpty />
                    ) : (
                        <div className="skills-cards">
                            {skills.map((skill) => (
                                <SkillCard
                                    key={skill.name}
                                    skill={skill}
                                    onClick={() => setSelectedSkill(skill)}
                                    onToggleVisibility={handleToggleVisibility}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <CreateSkillModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={handleSkillCreated}
                />
            )}

            {selectedSkill && (
                <SkillDetailModal
                    skill={selectedSkill}
                    onClose={() => setSelectedSkill(null)}
                    onDeleted={handleSkillDeleted}
                    onUpdated={handleReload}
                />
            )}
        </main>
    );
}
