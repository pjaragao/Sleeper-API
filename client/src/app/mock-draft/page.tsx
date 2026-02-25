'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getPlayers, Player } from '@/lib/api';
import { getDrafts, Draft, POSITION_COLORS, formatDraftType } from '@/lib/draft-api';

// Mock Draft Types
interface MockDraftConfig {
    teams: number;
    rounds: number;
    type: 'snake' | 'linear';
    userPosition: number;
    pickTimer: number;
    sourceLeagueId?: string;
}

interface MockPick {
    pick_no: number;
    round: number;
    team: number;
    player_id: string;
    player_name: string;
    position: string;
    nfl_team: string;
    is_user: boolean;
}

interface MockTeam {
    id: number;
    name: string;
    is_user: boolean;
    picks: MockPick[];
}

// Position colors for visual coding
const POSITION_BG: Record<string, string> = {
    QB: 'bg-red-500',
    RB: 'bg-green-500',
    WR: 'bg-blue-500',
    TE: 'bg-orange-500',
    K: 'bg-purple-500',
    DEF: 'bg-gray-500',
};

// Bot names
const BOT_NAMES = [
    'AutoDraft Bot', 'Fantasy AI', 'Draft Master', 'Pick Predictor',
    'Smart Drafter', 'QB Expert', 'RB Hunter', 'WR Focused',
    'TE Premium', 'Balanced Bot', 'Zero RB Bot', 'Hero RB Bot'
];

export default function MockDraftPage() {
    const [step, setStep] = useState<'config' | 'drafting' | 'complete'>('config');

    // Config state
    const [config, setConfig] = useState<MockDraftConfig>({
        teams: 10,
        rounds: 15,
        type: 'snake',
        userPosition: 1,
        pickTimer: 0,
    });

    // Draft state
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<MockTeam[]>([]);
    const [picks, setPicks] = useState<MockPick[]>([]);
    const [currentPick, setCurrentPick] = useState(1);
    const [playerSearch, setPlayerSearch] = useState('');
    const [positionFilter, setPositionFilter] = useState('');
    const [queue, setQueue] = useState<string[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoPicking, setAutoPicking] = useState(false);

    // Load players and drafts on mount
    useEffect(() => {
        loadInitialData();
    }, []);

    async function loadInitialData() {
        try {
            setLoading(true);
            const [playersRes, draftsRes] = await Promise.all([
                getPlayers({ limit: 500, sortBy: 'rank' }),
                getDrafts({ status: 'complete' })
            ]);
            setAvailablePlayers(playersRes.data);
            setDrafts(draftsRes.data);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    }

    // Initialize teams
    function initializeTeams() {
        const newTeams: MockTeam[] = [];
        for (let i = 1; i <= config.teams; i++) {
            newTeams.push({
                id: i,
                name: i === config.userPosition ? 'Você' : BOT_NAMES[(i - 1) % BOT_NAMES.length],
                is_user: i === config.userPosition,
                picks: []
            });
        }
        setTeams(newTeams);
    }

    // Get current team for pick
    function getCurrentTeam(): MockTeam | undefined {
        const totalPicks = config.teams * config.rounds;
        if (currentPick > totalPicks) return undefined;

        const round = Math.ceil(currentPick / config.teams);
        let pickInRound = ((currentPick - 1) % config.teams) + 1;

        // Snake logic: reverse order in even rounds
        if (config.type === 'snake' && round % 2 === 0) {
            pickInRound = config.teams - pickInRound + 1;
        }

        return teams.find(t => t.id === pickInRound);
    }

    // Make a pick
    function makePick(playerId: string) {
        const player = availablePlayers.find(p => p.player_id === playerId);
        if (!player) return;

        const team = getCurrentTeam();
        if (!team) return;

        const round = Math.ceil(currentPick / config.teams);
        const newPick: MockPick = {
            pick_no: currentPick,
            round,
            team: team.id,
            player_id: player.player_id,
            player_name: `${player.first_name} ${player.last_name}`,
            position: player.position,
            nfl_team: player.team || '',
            is_user: team.is_user
        };

        setPicks(prev => [...prev, newPick]);
        setAvailablePlayers(prev => prev.filter(p => p.player_id !== playerId));
        setQueue(prev => prev.filter(id => id !== playerId));

        // Update team picks
        setTeams(prev => prev.map(t =>
            t.id === team.id
                ? { ...t, picks: [...t.picks, newPick] }
                : t
        ));

        setCurrentPick(prev => prev + 1);

        // Check if draft complete
        if (currentPick >= config.teams * config.rounds) {
            setStep('complete');
        }
    }

    // Bot pick logic
    const makeAutoPick = useCallback(() => {
        const team = getCurrentTeam();
        if (!team || team.is_user) return;

        // Simple ADP-based picking with some randomness
        const positionNeeds = getPositionNeeds(team);
        let candidates = [...availablePlayers];

        // Weight towards needed positions
        if (positionNeeds.length > 0 && Math.random() > 0.3) {
            const neededPlayers = candidates.filter(p => positionNeeds.includes(p.position));
            if (neededPlayers.length > 0) {
                candidates = neededPlayers;
            }
        }

        // Take best available (with some randomness in top 3)
        const topN = Math.min(3, candidates.length);
        const pick = candidates[Math.floor(Math.random() * topN)];

        if (pick) {
            makePick(pick.player_id);
        }
    }, [availablePlayers, currentPick, teams, config]);

    // Get position needs for a team
    function getPositionNeeds(team: MockTeam): string[] {
        const counts: Record<string, number> = {};
        team.picks.forEach(p => {
            counts[p.position] = (counts[p.position] || 0) + 1;
        });

        const needs: string[] = [];
        if (!counts['QB'] || counts['QB'] < 2) needs.push('QB');
        if (!counts['RB'] || counts['RB'] < 4) needs.push('RB');
        if (!counts['WR'] || counts['WR'] < 4) needs.push('WR');
        if (!counts['TE'] || counts['TE'] < 2) needs.push('TE');
        if (!counts['K'] || counts['K'] < 1) needs.push('K');
        if (!counts['DEF'] || counts['DEF'] < 1) needs.push('DEF');

        return needs;
    }

    // Auto-run bot picks
    useEffect(() => {
        if (step !== 'drafting') return;

        const team = getCurrentTeam();
        if (!team) return;

        if (!team.is_user) {
            setAutoPicking(true);
            const timeout = setTimeout(() => {
                makeAutoPick();
                setAutoPicking(false);
            }, 500 + Math.random() * 1000);
            return () => clearTimeout(timeout);
        }
    }, [currentPick, step, makeAutoPick]);

    // Start draft
    function startDraft() {
        initializeTeams();
        setStep('drafting');
        setCurrentPick(1);
        setPicks([]);
    }

    // Filter players
    const filteredPlayers = availablePlayers.filter(p => {
        if (positionFilter && p.position !== positionFilter) return false;
        if (playerSearch) {
            const search = playerSearch.toLowerCase();
            const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
            if (!fullName.includes(search)) return false;
        }
        return true;
    });

    const currentTeam = getCurrentTeam();
    const isUserPick = currentTeam?.is_user || false;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    // Configuration Step
    if (step === 'config') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        🎯 Mock Draft
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Configure e pratique seu draft contra bots
                    </p>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6">
                        {/* Import from League */}
                        {drafts.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Importar Configurações
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    onChange={(e) => {
                                        const draft = drafts.find(d => d.draft_id === e.target.value);
                                        if (draft) {
                                            setConfig(prev => ({
                                                ...prev,
                                                teams: draft.settings.teams || 10,
                                                rounds: draft.settings.rounds || 15,
                                                type: (draft.type as 'snake' | 'linear') || 'snake',
                                                sourceLeagueId: draft.league_id
                                            }));
                                        }
                                    }}
                                >
                                    <option value="">-- Escolher um draft existente --</option>
                                    {drafts.map(d => (
                                        <option key={d.draft_id} value={d.draft_id}>
                                            {d.league_name} ({d.season}) - {formatDraftType(d.type)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Teams */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Número de Times
                            </label>
                            <input
                                type="number"
                                min={4}
                                max={16}
                                value={config.teams}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    teams: Number(e.target.value),
                                    userPosition: Math.min(prev.userPosition, Number(e.target.value))
                                }))}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Rounds */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Número de Rounds
                            </label>
                            <input
                                type="number"
                                min={5}
                                max={20}
                                value={config.rounds}
                                onChange={(e) => setConfig(prev => ({ ...prev, rounds: Number(e.target.value) }))}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* Draft Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Tipo de Draft
                            </label>
                            <div className="flex gap-4">
                                {['snake', 'linear'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setConfig(prev => ({ ...prev, type: type as 'snake' | 'linear' }))}
                                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${config.type === type
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        {type === 'snake' ? '🐍 Snake' : '📏 Linear'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* User Position */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Sua Posição no Draft
                            </label>
                            <div className="grid grid-cols-6 gap-2">
                                {Array.from({ length: config.teams }, (_, i) => i + 1).map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => setConfig(prev => ({ ...prev, userPosition: pos }))}
                                        className={`py-2 rounded-lg border-2 font-medium transition-colors ${config.userPosition === pos
                                                ? 'border-blue-500 bg-blue-500 text-white'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                                            }`}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Start Button */}
                        <button
                            onClick={startDraft}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-colors"
                        >
                            Iniciar Mock Draft 🚀
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Draft Complete
    if (step === 'complete') {
        const userTeam = teams.find(t => t.is_user);

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            🎉 Mock Draft Completo!
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Seu time está montado
                        </p>
                    </div>

                    {/* User Team */}
                    {userTeam && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                Seu Time
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {userTeam.picks.map(pick => (
                                    <div
                                        key={pick.pick_no}
                                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-bold">
                                            {pick.round}.{((pick.pick_no - 1) % config.teams) + 1}
                                        </div>
                                        <div className={`px-2 py-0.5 text-xs font-bold text-white rounded ${POSITION_BG[pick.position] || 'bg-gray-400'}`}>
                                            {pick.position}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {pick.player_name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {pick.nfl_team}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                setStep('config');
                                loadInitialData();
                            }}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            Novo Mock Draft
                        </button>
                        <Link
                            href="/drafts"
                            className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Ver Drafts Reais
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Drafting Step
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Main Draft Area */}
            <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            Mock Draft
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Round {Math.ceil(currentPick / config.teams)} • Pick {currentPick} of {config.teams * config.rounds}
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg font-medium ${isUserPick
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 animate-pulse'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {isUserPick ? '🎯 Sua vez!' : `${currentTeam?.name || 'Bot'} escolhendo...`}
                    </div>
                </div>

                {/* Player List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                    {/* Search/Filter */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-3">
                        <input
                            type="text"
                            placeholder="Buscar jogador..."
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
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

                    {/* Available Players */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-2">
                            {filteredPlayers.slice(0, 100).map((player, index) => {
                                const isQueued = queue.includes(player.player_id);
                                return (
                                    <div
                                        key={player.player_id}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isQueued
                                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                                                : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <div className="w-8 text-center text-sm font-medium text-gray-500">
                                            {index + 1}
                                        </div>
                                        <div className={`px-2 py-1 text-xs font-bold text-white rounded ${POSITION_BG[player.position] || 'bg-gray-400'}`}>
                                            {player.position}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {player.first_name} {player.last_name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {player.team || 'FA'}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setQueue(prev =>
                                                    isQueued
                                                        ? prev.filter(id => id !== player.player_id)
                                                        : [...prev, player.player_id]
                                                )}
                                                className={`px-3 py-1 text-xs rounded-lg transition-colors ${isQueued
                                                        ? 'bg-yellow-500 text-white'
                                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-yellow-100'
                                                    }`}
                                            >
                                                {isQueued ? '★' : '☆'}
                                            </button>
                                            {isUserPick && (
                                                <button
                                                    onClick={() => makePick(player.player_id)}
                                                    className="px-4 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                                                >
                                                    Draft
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar - Recent Picks & Queue */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
                {/* Queue */}
                {queue.length > 0 && (
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            🌟 Sua Fila ({queue.length})
                        </h3>
                        <div className="space-y-2">
                            {queue.slice(0, 5).map(playerId => {
                                const player = availablePlayers.find(p => p.player_id === playerId);
                                if (!player) return null;
                                return (
                                    <div key={playerId} className="flex items-center gap-2 text-sm">
                                        <span className={`px-1 py-0.5 text-xs text-white rounded ${POSITION_BG[player.position]}`}>
                                            {player.position}
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {player.first_name} {player.last_name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Picks */}
                <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        📋 Últimas Picks
                    </h3>
                    <div className="space-y-2">
                        {[...picks].reverse().slice(0, 20).map(pick => {
                            const team = teams.find(t => t.id === pick.team);
                            return (
                                <div
                                    key={pick.pick_no}
                                    className={`p-2 rounded-lg ${pick.is_user
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                            : 'bg-gray-50 dark:bg-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-gray-500">#{pick.pick_no}</span>
                                        <span className={`px-1 py-0.5 text-[10px] text-white rounded ${POSITION_BG[pick.position]}`}>
                                            {pick.position}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {pick.player_name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {team?.name || `Team ${pick.team}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
