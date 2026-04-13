// Empty state when no MCP servers are configured

import { Hammer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface McpToolsEmptyProps {
    onAddServer: () => void;
}

export function McpToolsEmpty({ onAddServer }: McpToolsEmptyProps) {
    const { t } = useTranslation();
    return (
        <div className="empty-state mcp-tools-empty">
            <Hammer className="empty-icon" size={32} strokeWidth={1.5} />
            <h2>{t('mcpTools.noToolsTitle')}</h2>
            <p>{t('mcpTools.noToolsDescription')}</p>
            <p className="empty-hint">
               {t('mcpTools.noToolsHint')}
            </p>
            <ul className="mcp-capabilities">
                <li>{t('mcpTools.capabilitySlack')}</li>
                <li>{t('mcpTools.capabilityProjects')}</li>
                <li>{t('mcpTools.capabilityFiles')}</li>
            </ul>
            <button className="btn-primary" onClick={onAddServer}>
                {t('mcpTools.integrateFirst')}
            </button>
        </div>
    );
}
