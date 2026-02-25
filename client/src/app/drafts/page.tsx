'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    getDrafts,
    Draft,
    formatDraftDate,
    formatDraftType
} from '@/lib/draft-api';

interface LeagueGroup {
    leagueName: string;
    leagueId: string;
    seasons: { season: string; drafts: Draft[] }[];
}

export default function DraftsPage() {
    const searchParams = useSearchParams();
    const leagueIdParam = searchParams.get('leagueId');

    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [leagueGroups, setLeagueGroups] = useState<LeagueGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(leagueIdParam);
    const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

    useEffect(() => {
        loadDrafts();
    }, []);

    useEffect(() => {
        if (leagueIdParam) {
            setSelectedLeagueId(leagueIdParam);
        }
    }, [leagueIdParam]);

    async function loadDrafts() {
        try {
            setLoading(true);
            const response = await getDrafts({});
            setDrafts(response.data);

            // Group by league, then by season
            const groupMap = new Map<string, LeagueGroup>();
            for (const draft of response.data) {
                const key = draft.league_name || draft.league_id;
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        leagueName: draft.league_name || 'Liga Desconhecida',
                        leagueId: draft.league_id,
                        seasons: []
                    });
                }
                const group = groupMap.get(key)!;
                let seasonGroup = group.seasons.find(s => s.season === draft.season);
                if (!seasonGroup) {
                    seasonGroup = { season: draft.season, drafts: [] };
                    group.seasons.push(seasonGroup);
                }
                seasonGroup.drafts.push(draft);
            }

            // Sort seasons descending
            for (const group of groupMap.values()) {
                group.seasons.sort((a, b) => b.season.localeCompare(a.season));
            }

            // Sort leagues alphabetically
            const groups = [...groupMap.values()].sort((a, b) => a.leagueName.localeCompare(b.leagueName));
            setLeagueGroups(groups);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            drafting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            pre_draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        };
        return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    };

    const selectedLeague = leagueGroups.find(g => g.leagueId === selectedLeagueId || g.leagueName === selectedLeagueId);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        📋 Drafts
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Histórico e análise de todos os seus drafts
                    </p>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && leagueGroups.length === 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Nenhum draft encontrado
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Importe uma liga para ver os drafts disponíveis
                        </p>
                        <Link
                            href="/manage"
                            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Gerenciar Ligas
                        </Link>
                    </div>
                )}

                {/* Main Content */}
                {!loading && leagueGroups.length > 0 && !selectedLeague && (
                    <>
                        {/* League Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {leagueGroups.map((league) => (
                                <button
                                    key={league.leagueId}
                                    onClick={() => setSelectedLeagueId(league.leagueId)}
                                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all p-5 text-left group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
                                            🏈
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {league.leagueName}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {league.seasons.length} temporada{league.seasons.length !== 1 ? 's' : ''}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {league.seasons.slice(0, 4).map(s => (
                                                    <span
                                                        key={s.season}
                                                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                                                    >
                                                        {s.season}
                                                    </span>
                                                ))}
                                                {league.seasons.length > 4 && (
                                                    <span className="px-2 py-0.5 text-xs text-gray-400">
                                                        +{league.seasons.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Selected League View */}
                {!loading && selectedLeague && (
                    <div>
                        {/* Back Button & Header */}
                        <button
                            onClick={() => { setSelectedLeagueId(null); setSelectedSeason(null); }}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-4 inline-block"
                        >
                            ← Voltar para Ligas
                        </button>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl">
                                    🏈
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {selectedLeague.leagueName}
                                    </h2>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {selectedLeague.seasons.length} temporada{selectedLeague.seasons.length !== 1 ? 's' : ''} de draft
                                    </p>
                                </div>
                            </div>

                            {/* Season Selector */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedSeason(null)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedSeason
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Todas
                                </button>
                                {selectedLeague.seasons.map(s => (
                                    <button
                                        key={s.season}
                                        onClick={() => setSelectedSeason(s.season)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedSeason === s.season
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {s.season}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Drafts List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {selectedLeague.seasons
                                .filter(s => !selectedSeason || s.season === selectedSeason)
                                .flatMap(s => s.drafts)
                                .map((draft) => (
                                    <Link
                                        key={draft.draft_id}
                                        href={`/drafts/${draft.draft_id}`}
                                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {draft.season}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {formatDraftType(draft.type)}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(draft.status)}`}>
                                                {draft.status === 'complete' ? 'Completo' :
                                                    draft.status === 'drafting' ? 'Em andamento' : 'Pré-Draft'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <span>👥</span>
                                                <span>{draft.settings.teams || '?'} times</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span>🔄</span>
                                                <span>{draft.settings.rounds || '?'} rounds</span>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                            📅 {formatDraftDate(draft.start_time)}
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
