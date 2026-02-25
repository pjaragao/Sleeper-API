'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PositionBadge } from '@/components/PositionBadge';
import { RefreshCw, Search, Filter, Calendar, Users, ArrowRight, User, Layout, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface Trade {
    transaction_id: string;
    league_id: string;
    league_name: string;
    season: string;
    created_at: number;
    roster_ids: number[];
    adds: Record<string, number>;
    drops: Record<string, number>;
    draft_picks: any[];
    metadata: any;
}

function GlobalTradesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [trades, setTrades] = useState<Trade[]>([]);
    const [playersMap, setPlayersMap] = useState<Record<string, any>>({});
    const [rosterMap, setRosterMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(20);

    // Filter States
    const [playerName, setPlayerName] = useState(searchParams.get('playerName') || '');
    const [managerId, setManagerId] = useState(searchParams.get('managerId') || '');
    const [leagueId, setLeagueId] = useState(searchParams.get('leagueId') || '');
    const [position, setPosition] = useState(searchParams.get('position') || '');

    // Autocomplete data
    const [importedUsers, setImportedUsers] = useState<any[]>([]);
    const [leagueNames, setLeagueNames] = useState<any[]>([]);
    const [playerSuggestions, setPlayerSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        loadFilterData();
    }, []);

    useEffect(() => {
        loadTrades();
    }, [limit, managerId, leagueId, position, playerName]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (playerName.length >= 2) {
                fetchPlayerSuggestions();
            } else {
                setPlayerSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [playerName]);

    async function fetchPlayerSuggestions() {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/players/search?q=${encodeURIComponent(playerName)}`);
            const data = await res.json();
            setPlayerSuggestions(data.data || []);
            setShowSuggestions(true);
        } catch (e) {
            console.error('Error fetching player suggestions:', e);
        }
    }

    async function loadFilterData() {
        try {
            const [usersRes, leaguesRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/users/imported`),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/leagues/imported-names`)
            ]);
            const usersData = await usersRes.json();
            const leaguesData = await leaguesRes.json();
            setImportedUsers(usersData.data || []);
            setLeagueNames(leaguesData.data || []);
        } catch (e) {
            console.error('Error loading filter data:', e);
        }
    }

    async function loadTrades() {
        setLoading(true);
        try {
            let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/trades?limit=${limit}`;
            if (playerName) url += `&playerName=${encodeURIComponent(playerName)}`;
            if (managerId) url += `&managerId=${managerId}`;
            if (leagueId) {
                // Check if it's a numeric ID (Sleeper IDs are long strings of digits)
                if (/^\d+$/.test(leagueId)) {
                    url += `&leagueId=${leagueId}`;
                } else {
                    url += `&leagueName=${encodeURIComponent(leagueId)}`;
                }
            }
            if (position) url += `&position=${position}`;

            const res = await fetch(url);
            const data = await res.json();
            setTrades(data.data || []);
            setPlayersMap(data.players || {});
            setRosterMap(data.rosters || {});
        } catch (error) {
            console.error('Error loading trades:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const clearFilters = () => {
        setPlayerName('');
        setManagerId('');
        setLeagueId('');
        setPosition('');
        router.push('/trades');
    };

    return (
        <div className="animate-fadeIn">
            <div className="flex flex-col mb-8">
                <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Histórico Global de Trades
                </h1>
                <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Veja todas as trocas realizadas em suas ligas sincronizadas
                </p>
            </div>

            {/* Advanced Filters Card */}
            <div className="card p-6 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-visible relative z-20">
                <div className="space-y-1 relative">
                    <label className="text-xs font-bold uppercase opacity-50 ml-1">Jogador NFL</label>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            type="text"
                            placeholder="Buscar jogador..."
                            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-full"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onFocus={() => playerName.length >= 2 && setShowSuggestions(true)}
                        />
                    </div>
                    {showSuggestions && playerSuggestions.length > 0 && (
                        <div
                            className="absolute top-full left-0 right-0 mt-1 card shadow-xl p-2 z-50 max-h-60 overflow-y-auto"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                        >
                            {playerSuggestions.map(p => (
                                <button
                                    key={p.player_id}
                                    className="w-full text-left p-2 hover:bg-[var(--primary-500)]/10 rounded flex items-center justify-between group transition-colors"
                                    onClick={() => {
                                        setPlayerName(p.full_name);
                                        setShowSuggestions(false);
                                    }}
                                >
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.full_name}</p>
                                        <p className="text-[10px] opacity-50">{p.position} - {p.team}</p>
                                    </div>
                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-50 ml-1">Liga</label>
                    <div className="relative">
                        <Layout className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <select
                            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-full appearance-none outline-none focus:ring-1 focus:ring-[var(--primary-500)]"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            value={leagueId}
                            onChange={(e) => setLeagueId(e.target.value)}
                        >
                            <option value="">Todas as Ligas</option>
                            {leagueNames.map((l: any) => (
                                <option key={l.name} value={l.name}>{l.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-50 ml-1">Manager</label>
                    <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <select
                            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-full appearance-none outline-none focus:ring-1 focus:ring-[var(--primary-500)]"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            value={managerId}
                            onChange={(e) => setManagerId(e.target.value)}
                        >
                            <option value="">Todos os Managers</option>
                            {importedUsers.map((u: any) => (
                                <option key={u.user_id} value={u.user_id}>
                                    {u.display_name} (@{u.username})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-50 ml-1">Posição</label>
                    <div className="relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <select
                            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-full appearance-none outline-none focus:ring-1 focus:ring-[var(--primary-500)]"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                        >
                            <option value="">Todas as Posições</option>
                            {['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'].map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                    </div>
                </div>

                <div className="lg:col-span-4 flex justify-end gap-2 pt-2">
                    {(playerName || managerId || leagueId || position) && (
                        <button onClick={clearFilters} className="btn-secondary text-xs py-1.5">
                            Limpar Filtros
                        </button>
                    )}
                    <button
                        onClick={loadTrades}
                        className="btn-primary flex items-center gap-2 text-xs py-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Filtrar
                    </button>
                </div>
            </div>

            {loading && trades.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
                </div>
            ) : (
                <div className="space-y-6">
                    {trades.map(trade => (
                        <div key={trade.transaction_id} className="card overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <Link href={`/leagues/${trade.league_id}`} className="hover:text-[var(--primary-500)] font-bold flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {trade.league_name} ({trade.season})
                                    </Link>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {trade.roster_ids.length} times envolvidos
                                    </span>
                                </div>
                                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {formatDate(trade.created_at)}
                                </span>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {trade.roster_ids.map(rosterId => {
                                        const receivedPlayers = Object.entries(trade.adds)
                                            .filter(([_, receiverId]) => receiverId === rosterId)
                                            .map(([playerId, _]) => playerId);

                                        const receivedPicks = (trade.draft_picks || [])
                                            .filter(p => p.owner_id === rosterId);

                                        const rInfo = rosterMap[`${trade.league_id}:${rosterId}`];

                                        return (
                                            <div key={rosterId} className="space-y-3">
                                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                                    {rInfo?.owner_name || `Time ${rosterId}`} recebeu:
                                                </p>
                                                <div className="space-y-2">
                                                    {(receivedPlayers.length === 0 && receivedPicks.length === 0) && (
                                                        <p className="text-sm italic opacity-50">Nada recebido</p>
                                                    )}
                                                    {receivedPlayers.map(pid => {
                                                        const p = playersMap[pid];
                                                        return (
                                                            <div key={pid} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                <div className="w-2 h-2 rounded-full bg-[var(--primary-500)]" />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{p?.full_name || `Player ${pid}`}</span>
                                                                    {p && (
                                                                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                                                            {p.position} - {p.team}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {receivedPicks.map((pick, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--primary-500)' }}>
                                                            <div className="w-2 h-2 rounded-full bg-[var(--primary-500)] opacity-50" />
                                                            <span className="font-medium">
                                                                {pick.season} Rd {pick.round}
                                                                <span className="text-[10px] opacity-70 ml-1">
                                                                    (Original: {pick.org_owner_name || `Time ${pick.org_owner_id}`})
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {trades.length === limit && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => setLimit(prev => prev + 20)}
                                className="btn-secondary"
                            >
                                Carregar mais trades
                            </button>
                        </div>
                    )}

                    {trades.length === 0 && !loading && (
                        <div className="text-center py-20 card">
                            <ArrowRight className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p style={{ color: 'var(--text-secondary)' }}>Nenhum trade encontrado com os filtros atuais.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function GlobalTradesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-20"><RefreshCw className="w-8 h-8 animate-spin text-[var(--primary-500)]" /></div>}>
            <GlobalTradesContent />
        </Suspense>
    );
}
