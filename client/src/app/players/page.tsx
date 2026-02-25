'use client';

import { useState, useEffect } from 'react';
import { getPlayers, Player } from '@/lib/api';
import { PlayerCard } from '@/components/PlayerCard';
import { Search, RefreshCw, Filter, X } from 'lucide-react';

const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const teams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
];

export default function PlayersPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [position, setPosition] = useState('');
    const [team, setTeam] = useState('');
    const [sortBy, setSortBy] = useState<'rank' | 'position'>('rank');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadPlayers();
    }, [position, team, sortBy]);

    async function loadPlayers() {
        setLoading(true);
        try {
            const data = await getPlayers({
                search: search || undefined,
                position: position || undefined,
                team: team || undefined,
                sortBy: sortBy,
                limit: 100
            });
            setPlayers(data.data);
        } catch (error) {
            console.error('Error loading players:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch() {
        loadPlayers();
    }

    function clearFilters() {
        setSearch('');
        setPosition('');
        setTeam('');
        setSortBy('rank');
    }

    const hasFilters = position || team || sortBy !== 'rank';

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Jogadores
                    </h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {players.length.toLocaleString()} jogadores encontrados
                    </p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="card p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Buscar por nome..."
                            className="w-full pl-10 pr-4 py-3 rounded-lg border"
                            style={{
                                background: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-3 rounded-lg border flex items-center gap-2 transition-all ${showFilters ? 'ring-2 ring-blue-500' : ''
                                }`}
                            style={{
                                background: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <Filter className="w-5 h-5" />
                            <span className="hidden md:inline">Filtros</span>
                        </button>

                        <button
                            onClick={handleSearch}
                            className="btn-primary px-6"
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm mb-2 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Posição
                                </label>
                                <select
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderColor: 'var(--border-primary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Todas</option>
                                    {positions.map(pos => (
                                        <option key={pos} value={pos}>{pos}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm mb-2 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Time
                                </label>
                                <select
                                    value={team}
                                    onChange={(e) => setTeam(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderColor: 'var(--border-primary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Todos</option>
                                    {teams.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm mb-2 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Ordenar por
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'rank' | 'position')}
                                    className="w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderColor: 'var(--border-primary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="rank">Popularidade (Rank)</option>
                                    <option value="position">Posição (QB, RB...)</option>
                                </select>
                            </div>
                        </div>

                        {hasFilters && (
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-500/10 transition-colors"
                                    style={{ color: 'var(--accent-danger)' }}
                                >
                                    <X className="w-4 h-4" />
                                    Limpar Filtros
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Players Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {players.map((player) => (
                        <PlayerCard key={player.player_id} player={player} />
                    ))}
                </div>
            )}

            {!loading && players.length === 0 && (
                <div className="text-center py-12">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Nenhum jogador encontrado com esses filtros.
                    </p>
                </div>
            )}
        </div>
    );
}
