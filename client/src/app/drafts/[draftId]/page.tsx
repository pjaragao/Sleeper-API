'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    getDraft,
    getDraftBoard,
    getDraftAnalysis,
    Draft,
    DraftBoardData,
    DraftAnalysis,
    POSITION_COLORS,
    GRADE_COLORS,
    formatDraftDate,
    formatDraftType
} from '@/lib/draft-api';

type Tab = 'board' | 'analysis' | 'timeline';

export default function DraftDetailPage({ params }: { params: Promise<{ draftId: string }> }) {
    const resolvedParams = use(params);
    const { draftId } = resolvedParams;

    const [draft, setDraft] = useState<Draft | null>(null);
    const [board, setBoard] = useState<DraftBoardData | null>(null);
    const [analysis, setAnalysis] = useState<DraftAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('board');
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

    useEffect(() => {
        loadDraftData();
    }, [draftId]);

    async function loadDraftData() {
        try {
            setLoading(true);
            const [draftData, boardData, analysisData] = await Promise.all([
                getDraft(draftId),
                getDraftBoard(draftId),
                getDraftAnalysis(draftId)
            ]);
            setDraft(draftData);
            setBoard(boardData);
            setAnalysis(analysisData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const getPositionColor = (position: string) => {
        return POSITION_COLORS[position] || '#6b7280';
    };

    const getPositionBgClass = (position: string) => {
        const classes: Record<string, string> = {
            QB: 'bg-red-500',
            RB: 'bg-green-500',
            WR: 'bg-blue-500',
            TE: 'bg-orange-500',
            K: 'bg-purple-500',
            DEF: 'bg-gray-500',
            DL: 'bg-teal-500',
            LB: 'bg-yellow-500',
            DB: 'bg-pink-500',
        };
        return classes[position] || 'bg-gray-400';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    if (error || !draft) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                        <h2 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">Erro</h2>
                        <p className="text-red-600 dark:text-red-300">{error || 'Draft não encontrado'}</p>
                        <Link href="/drafts" className="inline-block mt-4 text-blue-600 hover:underline">
                            ← Voltar para Drafts
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/drafts" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 inline-block">
                        ← Voltar para Drafts
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                                {draft.league_name || 'Draft'}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {draft.season} • {formatDraftType(draft.type)} • {formatDraftDate(draft.start_time)}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${draft.status === 'complete'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {draft.status === 'complete' ? 'Completo' : draft.status}
                            </span>
                            {draft.metadata?.scoring_type && (
                                <span className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                    {draft.metadata.scoring_type.toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-t-xl border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex">
                        {[
                            { id: 'board', label: '📋 Draft Board', icon: '📋' },
                            { id: 'analysis', label: '📊 Análise', icon: '📊' },
                            { id: 'timeline', label: '📜 Timeline', icon: '📜' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
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
                <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-sm p-4 md:p-6">
                    {/* Board Tab */}
                    {activeTab === 'board' && board && (
                        <div className="overflow-x-auto">
                            <table className="table-fixed border-collapse" style={{ width: `${60 + (board.teams.length * 140)}px` }}>
                                <thead>
                                    <tr>
                                        <th className="w-[60px] p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 sticky left-0 z-10">
                                            RD
                                        </th>
                                        {board.teams.map((team) => (
                                            <th
                                                key={team.draft_slot}
                                                className={`w-[140px] p-2 text-center text-xs font-medium bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-l border-gray-100 dark:border-gray-700 transition-colors ${selectedTeam === team.draft_slot ? 'text-blue-600 dark:text-blue-400 font-bold ring-2 ring-inset ring-blue-500' : 'text-gray-500 dark:text-gray-400'
                                                    }`}
                                                onClick={() => setSelectedTeam(selectedTeam === team.draft_slot ? null : team.draft_slot)}
                                            >
                                                <div className="truncate px-1" title={team.owner_name}>
                                                    {team.owner_name}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: board.settings.rounds }, (_, round) => {
                                        const roundNum = round + 1;
                                        const isSnake = board.type === 'snake';
                                        const isReversed = isSnake && roundNum % 2 === 0;

                                        return (
                                            <tr key={roundNum} className="border-t border-gray-100 dark:border-gray-700">
                                                <td className="w-[60px] p-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 sticky left-0 z-10">
                                                    {roundNum}
                                                </td>
                                                {(isReversed ? [...board.teams].reverse() : board.teams).map((team) => {
                                                    // Find pick by round and draft_slot (not roster_id!)
                                                    const pick = board.picks.find(
                                                        p => p.round === roundNum && p.draft_slot === team.draft_slot
                                                    );

                                                    if (!pick) {
                                                        return (
                                                            <td key={`${roundNum}-${team.draft_slot}`} className="w-[140px] p-1 border-l border-gray-50 dark:border-gray-700/30">
                                                                <div className="h-[85px] bg-gray-50 dark:bg-gray-700/30 rounded"></div>
                                                            </td>
                                                        );
                                                    }

                                                    const isHighlighted = selectedTeam === team.draft_slot;
                                                    const isTradedPick = pick.picker_name && pick.picker_name !== team.owner_name;

                                                    return (
                                                        <td key={`${roundNum}-${team.draft_slot}`} className="w-[140px] p-1 border-l border-gray-50 dark:border-gray-700/30">
                                                            <div
                                                                className={`p-2 rounded text-xs transition-all h-[85px] flex flex-col ${isHighlighted
                                                                    ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800 z-10 relative'
                                                                    : ''
                                                                    } ${pick.is_keeper
                                                                        ? 'ring-2 ring-yellow-400 ring-offset-1 dark:ring-offset-gray-800'
                                                                        : ''
                                                                    }`}
                                                                style={{ backgroundColor: getPositionColor(pick.position) + '20' }}
                                                            >
                                                                {/* Traded pick indicator */}
                                                                {isTradedPick && (
                                                                    <div className="text-[9px] text-white bg-purple-600 dark:bg-purple-500 px-1 py-0.5 rounded mb-1 truncate -mx-1 -mt-1" title={`Pick feita por ${pick.picker_name}`}>
                                                                        →{pick.picker_name}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1 mb-1">
                                                                    <span
                                                                        className={`w-6 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded ${getPositionBgClass(pick.position)}`}
                                                                    >
                                                                        {pick.position}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                        #{pick.pick_no}
                                                                    </span>
                                                                    {pick.is_keeper && (
                                                                        <span className="text-[10px]" title="Keeper">🔒</span>
                                                                    )}
                                                                </div>
                                                                <div className="font-medium text-gray-900 dark:text-white truncate flex-1" title={pick.player_name}>
                                                                    {pick.player_name}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                                                    {pick.team || 'FA'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Analysis Tab */}
                    {activeTab === 'analysis' && analysis && (
                        <div className="space-y-6">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {analysis.total_picks}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Picks</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {analysis.teams.length}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Times</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {Object.keys(analysis.position_breakdown.totals).length}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Posições</div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {analysis.teams.reduce((sum, t) => sum + t.keepers, 0)}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Keepers</div>
                                </div>
                            </div>

                            {/* Team Grades */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Notas por Time
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {analysis.teams.map((team) => (
                                        <div
                                            key={team.roster_id}
                                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {team.owner_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {team.picks.length} picks • {team.keepers} keepers
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white"
                                                    style={{ backgroundColor: GRADE_COLORS[team.grade] || '#6b7280' }}
                                                >
                                                    {team.grade}
                                                </div>
                                            </div>

                                            {/* Position Breakdown */}
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {Object.entries(team.position_counts).map(([pos, count]) => (
                                                    <span
                                                        key={pos}
                                                        className={`px-2 py-0.5 text-xs text-white rounded ${getPositionBgClass(pos)}`}
                                                    >
                                                        {pos}: {count}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Stats */}
                                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Desvio ADP Médio:</span>
                                                    <span className={team.avg_adp_deviation < 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {team.avg_adp_deviation > 0 ? '+' : ''}{team.avg_adp_deviation}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Valor Total:</span>
                                                    <span className="text-blue-600">{team.total_value}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Position Distribution */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Distribuição por Posição
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {Object.entries(analysis.position_breakdown.totals)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([pos, count]) => {
                                            const percentage = Math.round((count / analysis.total_picks) * 100);
                                            return (
                                                <div key={pos} className="flex items-center gap-2">
                                                    <div
                                                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white ${getPositionBgClass(pos)}`}
                                                    >
                                                        {pos}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {count}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {percentage}%
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline Tab */}
                    {activeTab === 'timeline' && board && (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {board.picks.map((pick) => {
                                const team = board.teams.find(t => t.roster_id === pick.roster_id);
                                return (
                                    <div
                                        key={pick.pick_no}
                                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                                            {pick.pick_no}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 text-xs font-bold text-white rounded ${getPositionBgClass(pick.position)}`}>
                                                    {pick.position}
                                                </span>
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {pick.player_name}
                                                </span>
                                                {pick.is_keeper && <span title="Keeper">🔒</span>}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {pick.team} • Round {pick.round}, Pick {pick.draft_slot}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {team?.owner_name || `Team ${pick.roster_id}`}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Position Legend */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Legenda
                    </h3>
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(POSITION_COLORS).map(([pos, color]) => (
                            <div key={pos} className="flex items-center gap-2">
                                <div className={`w-6 h-5 rounded text-[10px] font-bold text-white flex items-center justify-center ${getPositionBgClass(pos)}`}>
                                    {pos}
                                </div>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 ml-4">
                            <span>🔒</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Keeper</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
