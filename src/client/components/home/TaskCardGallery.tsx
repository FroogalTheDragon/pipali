// Gallery layout for active task cards

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveTask } from '../../types';
import { TaskCard } from './TaskCard';

interface TaskCardGalleryProps {
    tasks: ActiveTask[];
    onSelectTask: (conversationId: string) => void;
}

export function TaskCardGallery({ tasks, onSelectTask }: TaskCardGalleryProps) {
    const { t } = useTranslation();
    return (
        <div className="task-gallery">
            <div className="task-gallery-header">
                <h2>{t('tasks.activeTasks')}</h2>
                <span className="task-count">
                    {t('tasks.taskCount', { count: tasks.length })}
                </span>
            </div>
            <div className="task-cards">
                {tasks.map(task => (
                    <TaskCard
                        key={task.conversationId}
                        task={task}
                        onClick={() => onSelectTask(task.conversationId)}
                    />
                ))}
            </div>
        </div>
    );
}
