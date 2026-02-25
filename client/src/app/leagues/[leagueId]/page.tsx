'use client';

import { useState, useEffect, use } from 'react';
import { getLeague, getRosters, getRosterPlayers, League, Roster, Player, RosterPlayer } from '@/lib/api';
import { PositionBadge } from '@/components/PositionBadge';
import { RefreshCw, ChevronDown, ChevronUp, Trophy, Star } from 'lucide-react';
import Link from 'next/link';

export default function LeagueDetailPage({ params }: { params: Promise<{ leagueId: string }> }) {
    const { leagueId } = use(params);
    const [league, setLeague] = useState<League | null>(null);
    const [rosters, setRosters] = useState<Roster[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRoster, setExpandedRoster] = useState<number | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const [leagueData, rostersData] = await Promise.all([
                    getLeague(leagueId),
                    getRosters(leagueId)
                ]);
                setLeague(leagueData);
                setRosters(rostersData.data.sort((a, b) => {
                    const aWins = a.wins || 0;
                    const bWins = b.wins || 0;
                    return bWins - aWins;
                }));

                // Fetch history
                const historyData = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/leagues/${leagueId}/history`).then(res => res.json());
                setHistory(historyData.data || []);
            } catch (error) {
                console.error('Error loading league:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [leagueId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
            </div>
        );
    }

    if (!league) {
        return (
            <div className="text-center py-12">
                <p style={{ color: 'var(--text-secondary)' }}>Liga não encontrada</p>
                <Link href="/leagues" className="btn-primary mt-4 inline-block">
                    Voltar para Ligas
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="flex items-start gap-6 mb-8">
                <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    🏈
                </div>
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4">
                        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {league.name}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium opacity-50">Temporada:</span>
                            <select
                                className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--primary-500)] cursor-pointer hover:border-[var(--primary-500)] transition-all"
                                style={{ color: 'var(--text-primary)' }}
                                value={leagueId}
                                onChange={(e) => window.location.href = `/leagues/${e.target.value}`}
                            >
                                {history.length > 0 ? (
                                    history.map(item => (
                                        <option key={item.league_id} value={item.league_id}>
                                            {item.season} {item.status === 'pre_draft' ? '(Pré-draft)' : ''}
                                        </option>
                                    ))
                                ) : (
                                    <option value={leagueId}>{league.season}</option>
                                )}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-secondary)] text-xs font-semibold">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            {league.total_rosters} times
                        </div>
                        <span
                            className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                            style={{
                                background: league.status === 'in_season' ? 'var(--primary-500)' : 'var(--bg-tertiary)',
                                color: league.status === 'in_season' ? 'white' : 'var(--text-secondary)',
                                opacity: league.status === 'in_season' ? 1 : 0.7
                            }}
                        >
                            {league.status === 'in_season' ? 'Em andamento' :
                                league.status === 'pre_draft' ? 'Pré-draft' :
                                    league.status === 'post_season' ? 'Finalizada' : league.status}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/drafts?leagueId=${leagueId}`}
                        className="btn-secondary flex items-center gap-2"
                    >
                        📋 Ver Drafts
                    </Link>
                    <Link
                        href={`/trades?leagueId=${encodeURIComponent(league.name)}`}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Ver Trades
                    </Link>
                    <Link
                        href={`/trade-simulator?league=${leagueId}`}
                        className="btn-primary"
                    >
                        Simular Trade
                    </Link>
                </div>
            </div>

            {/* Standings */}
            <div className="card">
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        <Trophy className="w-5 h-5 inline mr-2" style={{ color: 'var(--accent-warning)' }} />
                        Classificação
                    </h2>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                    {rosters.map((roster, index) => (
                        <div key={roster.roster_id}>
                            <button
                                onClick={() => setExpandedRoster(
                                    expandedRoster === roster.roster_id ? null : roster.roster_id
                                )}
                                className="w-full p-4 flex items-center gap-4 transition-colors hover:bg-[var(--bg-secondary)]"
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                                    style={{
                                        background: index < 3 ? 'var(--primary-500)' : 'var(--bg-tertiary)',
                                        color: index < 3 ? 'white' : 'var(--text-secondary)'
                                    }}
                                >
                                    {index + 1}
                                </div>

                                <div className="flex-1 text-left flex items-center gap-2">
                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {roster.owner_name || `Time ${roster.roster_id}`}
                                    </p>
                                    {roster.owner_id && (
                                        <Link
                                            href={`/trades?managerId=${roster.owner_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1 rounded hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--primary-500)] transition-colors"
                                            title="Ver Trades deste manager"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center">
                                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {roster.wins}-{roster.losses}{roster.ties > 0 ? `-${roster.ties}` : ''}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Record</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {roster.fpts?.toFixed(1) || 0}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>PF</p>
                                    </div>
                                </div>

                                {expandedRoster === roster.roster_id ? (
                                    <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                ) : (
                                    <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                )}
                            </button>

                            {/* Expanded roster view */}
                            {expandedRoster === roster.roster_id && (
                                <RosterDetails leagueId={leagueId} rosterId={roster.roster_id} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RosterDetails({ leagueId, rosterId }: { leagueId: string, rosterId: number }) {
    const [players, setPlayers] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPlayers() {
            try {
                const data = await getRosterPlayers(leagueId, rosterId);
                setPlayers(data.data);
            } catch (error) {
                console.error('Error loading roster players:', error);
            } finally {
                setLoading(false);
            }
        }
        loadPlayers();
    }, [leagueId, rosterId]);

    if (loading) {
        return (
            <div className="p-4 pl-16 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs">Carregando jogadores...</span>
            </div>
        );
    }

    return (
        <div className="p-4 pt-0 pl-16">
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                Roster Completo:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map(player => (
                    <div
                        key={player.player_id}
                        className="flex items-center gap-2 p-2 rounded-lg"
                        style={{
                            background: player.is_pick ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--bg-secondary)',
                            border: player.is_pick ? '1px dashed var(--primary-500)' : '1px solid var(--border-primary)'
                        }}
                    >
                        <PositionBadge position={player.position} size="sm" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-medium truncate" style={{ color: player.is_pick ? 'var(--primary-500)' : 'var(--text-primary)' }}>
                                    {player.full_name}
                                </span>
                                {player.is_starter && (
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                )}
                                {!player.is_pick && player.player_id !== '0' && (
                                    <Link
                                        href={`/trades?playerName=${encodeURIComponent(player.full_name)}`}
                                        className="p-1 rounded hover:bg-white/10 text-[var(--text-tertiary)] hover:text-[var(--primary-500)] transition-colors"
                                        title={`Ver trades de ${player.full_name}`}
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                <span>{player.team || 'FA'}</span>
                                {player.injury_status && player.injury_status !== 'null' && !player.is_pick && (
                                    <span className="text-red-400 font-bold">{player.injury_status}</span>
                                )}
                                {player.is_pick && (
                                    <span style={{ color: 'var(--primary-400)' }}>Draft Pick</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
