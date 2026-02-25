interface PositionBadgeProps {
    position: string;
    size?: 'sm' | 'md';
}

const positionColors: Record<string, string> = {
    QB: 'bg-red-500',
    RB: 'bg-green-500',
    WR: 'bg-blue-500',
    TE: 'bg-amber-500',
    K: 'bg-purple-500',
    DEF: 'bg-gray-500',
    DL: 'bg-gray-600',
    LB: 'bg-gray-600',
    DB: 'bg-gray-600',
};

export function PositionBadge({ position, size = 'md' }: PositionBadgeProps) {
    const colorClass = positionColors[position] || 'bg-gray-500';
    const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';

    return (
        <span className={`${colorClass} ${sizeClass} text-white font-bold rounded`}>
            {position}
        </span>
    );
}
