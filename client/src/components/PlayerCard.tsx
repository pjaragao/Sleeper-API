import { Player } from '@/lib/api';
import { PositionBadge } from './PositionBadge';
import { AlertCircle } from 'lucide-react';

interface PlayerCardProps {
    player: Player;
    onClick?: () => void;
    selected?: boolean;
    compact?: boolean;
}

export function PlayerCard({ player, onClick, selected, compact }: PlayerCardProps) {
    const hasInjury = player.injury_status && player.injury_status !== 'null';

    if (compact) {
        return (
            <div
                onClick={onClick}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selected ? 'ring-2 ring-blue-500' : ''
                    }`}
                style={{
                    background: selected ? 'var(--primary-500)' : 'var(--bg-card)',
                    color: selected ? 'white' : 'var(--text-primary)',
                    border: `1px solid ${selected ? 'var(--primary-500)' : 'var(--border-primary)'}`,
                }}
            >
                <PositionBadge position={player.position} size="sm" />
                <span className="font-medium truncate flex-1">
                    {player.first_name} {player.last_name}
                </span>
                <span className="text-xs opacity-70">{player.team || 'FA'}</span>
                {hasInjury && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                )}
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`card p-4 cursor-pointer transition-all hover:scale-[1.02] ${selected ? 'ring-2 ring-blue-500' : ''
                }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <PositionBadge position={player.position} />
                        {hasInjury && (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-500">
                                {player.injury_status}
                            </span>
                        )}
                    </div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {player.first_name} {player.last_name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {player.team || 'Free Agent'} • {player.age} anos
                    </p>
                </div>
            </div>
        </div>
    );
}
