'use client';

import { useState, useEffect } from 'react';
import { getPlayers, Player } from '@/lib/api';

// Types
interface TierPlayer extends Player {
    tier: number;
    customRank: number;
}

interface Tier {
    id: number;
    name: string;
    color: string;
    players: TierPlayer[];
}

// Position colors
const POSITION_COLORS: Record<string, string> = {
    QB: 'bg-red-500',
    RB: 'bg-green-500',
    WR: 'bg-blue-500',
    TE: 'bg-orange-500',
    K: 'bg-purple-500',
    DEF: 'bg-gray-500',
};

const TIER_COLORS = [
    'bg-emerald-500',
    'bg-green-500',
    'bg-lime-500',
    'bg-yellow-500',
    'bg-amber-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-rose-500',
];

export default function DraftToolsPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'cheatsheet' | 'tiers' | 'scarcity'>('cheatsheet');
    const [positionFilter, setPositionFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

    // Tier state
    const [tiers, setTiers] = useState<Tier[]>([
        { id: 1, name: 'Tier 1 - Elite', color: TIER_COLORS[0], players: [] },
        { id: 2, name: 'Tier 2 - Great', color: TIER_COLORS[1], players: [] },
        { id: 3, name: 'Tier 3 - Good', color: TIER_COLORS[2], players: [] },
        { id: 4, name: 'Tier 4 - Solid', color: TIER_COLORS[3], players: [] },
        { id: 5, name: 'Tier 5 - Average', color: TIER_COLORS[4], players: [] },
        { id: 6, name: 'Tier 6 - Depth', color: TIER_COLORS[5], players: [] },
    ]);

    useEffect(() => {
        loadPlayers();
    }, [positionFilter]);

    async function loadPlayers() {
        try {
            setLoading(true);
            const params: Parameters<typeof getPlayers>[0] = {
                limit: 300,
                sortBy: 'rank'
            };
            if (positionFilter) params.position = positionFilter;
            const response = await getPlayers(params);
            setPlayers(response.data);
        } catch (err) {
            console.error('Error loading players:', err);
        } finally {
            setLoading(false);
        }
    }

    // Toggle player selection
    function togglePlayer(playerId: string) {
        setSelectedPlayers(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) {
                next.delete(playerId);
            } else {
                next.add(playerId);
            }
            return next;
        });
    }

    // Add selected players to tier
    function addToTier(tierId: number) {
        if (selectedPlayers.size === 0) return;

        const playersToAdd = players.filter(p => selectedPlayers.has(p.player_id));

        setTiers(prev => prev.map(tier => {
            if (tier.id === tierId) {
                const existingIds = new Set(tier.players.map(p => p.player_id));
                const newPlayers = playersToAdd
                    .filter(p => !existingIds.has(p.player_id))
                    .map((p, i) => ({
                        ...p,
                        tier: tierId,
                        customRank: tier.players.length + i + 1
                    }));
                return { ...tier, players: [...tier.players, ...newPlayers] };
            }
            return tier;
        }));

        setSelectedPlayers(new Set());
    }

    // Remove player from tier
    function removeFromTier(tierId: number, playerId: string) {
        setTiers(prev => prev.map(tier => {
            if (tier.id === tierId) {
                return {
                    ...tier,
                    players: tier.players.filter(p => p.player_id !== playerId)
                };
            }
            return tier;
        }));
    }

    // Filter players
    const filteredPlayers = players.filter(p => {
        if (searchQuery) {
            const search = searchQuery.toLowerCase();
            const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
            if (!fullName.includes(search)) return false;
        }
        return true;
    });

    // Get players already in tiers
    const playersInTiers = new Set(tiers.flatMap(t => t.players.map(p => p.player_id)));

    // Calculate position scarcity
    const positionCounts: Record<string, { total: number; remaining: number }> = {};
    players.forEach(p => {
        if (!positionCounts[p.position]) {
            positionCounts[p.position] = { total: 0, remaining: 0 };
        }
        positionCounts[p.position].total++;
        if (!playersInTiers.has(p.player_id)) {
            positionCounts[p.position].remaining++;
        }
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        🛠️ Ferramentas de Draft
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Prepare-se para o seu draft com rankings personalizados e análise de scarcity
                    </p>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-t-xl border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex">
                        {[
                            { id: 'cheatsheet', label: '📋 Cheat Sheet', icon: '📋' },
                            { id: 'tiers', label: '📊 Tier Maker', icon: '📊' },
                            { id: 'scarcity', label: '📉 Scarcity', icon: '📉' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-sm">
                    {/* Cheat Sheet Tab */}
                    {activeTab === 'cheatsheet' && (
                        <div className="p-6">
                            {/* Filters */}
                            <div className="flex gap-4 mb-6">
                                <input
                                    type="text"
                                    placeholder="Buscar jogador..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                />
                                <select
                                    value={positionFilter}
                                    onChange={(e) => setPositionFilter(e.target.value)}
                                    className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                >
                                    <option value="">Todas Posições</option>
                                    {['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(pos => (
                                        <option key={pos} value={pos}>{pos}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Selection Controls */}
                            {selectedPlayers.size > 0 && (
                                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
                                    <span className="text-blue-700 dark:text-blue-300">
                                        {selectedPlayers.size} jogadores selecionados
                                    </span>
                                    <div className="flex gap-2">
                                        {tiers.map(tier => (
                                            <button
                                                key={tier.id}
                                                onClick={() => addToTier(tier.id)}
                                                className={`px-3 py-1 text-xs text-white rounded-lg ${tier.color}`}
                                            >
                                                + Tier {tier.id}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setSelectedPlayers(new Set())}
                                            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                                        >
                                            Limpar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Player List */}
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {filteredPlayers.map((player, index) => {
                                    const isSelected = selectedPlayers.has(player.player_id);
                                    const inTier = playersInTiers.has(player.player_id);

                                    return (
                                        <div
                                            key={player.player_id}
                                            onClick={() => !inTier && togglePlayer(player.player_id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isSelected
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                                                    : inTier
                                                        ? 'bg-gray-100 dark:bg-gray-700/50 opacity-50'
                                                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="w-8 text-center text-sm font-medium text-gray-500">
                                                {index + 1}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => { }}
                                                disabled={inTier}
                                                className="w-4 h-4"
                                            />
                                            <div className={`px-2 py-0.5 text-xs font-bold text-white rounded ${POSITION_COLORS[player.position] || 'bg-gray-400'}`}>
                                                {player.position}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {player.first_name} {player.last_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {player.team || 'FA'} • {player.age ? `${player.age} anos` : ''}
                                                </div>
                                            </div>
                                            {inTier && (
                                                <span className="text-xs text-gray-400">Em tier</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tiers Tab */}
                    {activeTab === 'tiers' && (
                        <div className="p-6 space-y-4">
                            {tiers.map(tier => (
                                <div key={tier.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className={`${tier.color} px-4 py-2 flex items-center justify-between`}>
                                        <span className="font-semibold text-white">
                                            {tier.name} ({tier.players.length})
                                        </span>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 min-h-[80px]">
                                        {tier.players.length === 0 ? (
                                            <div className="text-center text-gray-400 py-4">
                                                Arraste jogadores aqui ou selecione na aba Cheat Sheet
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {tier.players.map(player => (
                                                    <div
                                                        key={player.player_id}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm group"
                                                    >
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${POSITION_COLORS[player.position]}`}>
                                                            {player.position}
                                                        </span>
                                                        <span className="text-sm text-gray-900 dark:text-white">
                                                            {player.first_name} {player.last_name}
                                                        </span>
                                                        <button
                                                            onClick={() => removeFromTier(tier.id, player.player_id)}
                                                            className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Add Tier Button */}
                            <button
                                onClick={() => setTiers(prev => [
                                    ...prev,
                                    {
                                        id: prev.length + 1,
                                        name: `Tier ${prev.length + 1}`,
                                        color: TIER_COLORS[prev.length % TIER_COLORS.length],
                                        players: []
                                    }
                                ])}
                                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                            >
                                + Adicionar Tier
                            </button>
                        </div>
                    )}

                    {/* Scarcity Tab */}
                    {activeTab === 'scarcity' && (
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Escassez Posicional
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Quantos jogadores startáveis restam em cada posição
                            </p>

                            <div className="space-y-4">
                                {Object.entries(positionCounts)
                                    .filter(([pos]) => ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos))
                                    .sort((a, b) => {
                                        const order = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
                                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                                    })
                                    .map(([pos, counts]) => {
                                        const percentage = Math.round((counts.remaining / counts.total) * 100);
                                        const urgency = percentage < 30 ? 'high' : percentage < 60 ? 'medium' : 'low';

                                        return (
                                            <div key={pos} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1 text-sm font-bold text-white rounded ${POSITION_COLORS[pos]}`}>
                                                            {pos}
                                                        </span>
                                                        <span className="text-gray-900 dark:text-white font-medium">
                                                            {counts.remaining} restantes
                                                        </span>
                                                    </div>
                                                    <span className={`text-sm font-medium ${urgency === 'high' ? 'text-red-500' :
                                                            urgency === 'medium' ? 'text-yellow-500' : 'text-green-500'
                                                        }`}>
                                                        {percentage}%
                                                    </span>
                                                </div>
                                                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all ${urgency === 'high' ? 'bg-red-500' :
                                                                urgency === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                                            }`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {counts.total - counts.remaining} de {counts.total} já draftados/alocados
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Tips */}
                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                                    💡 Dicas de Draft
                                </h4>
                                <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                                    <li>• Posições com menos de 30% restantes estão em alta demanda</li>
                                    <li>• RB e WR geralmente são as posições mais competitivas</li>
                                    <li>• Considere draftar K e DEF nos últimos rounds</li>
                                    <li>• TE premium pode valer a pena se elite TEs estiverem disponíveis cedo</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
