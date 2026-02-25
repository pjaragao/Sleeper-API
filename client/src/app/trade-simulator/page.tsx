'use client';

import { useState, useEffect } from 'react';
import { getLeagues, getRosters, getRosterPlayers, League, Roster, RosterPlayer } from '@/lib/api';
import { PositionBadge } from '@/components/PositionBadge';
import { ArrowLeftRight, X, RefreshCw, Check, Star } from 'lucide-react';

interface TradeParty {
    roster: Roster | null;
    players: RosterPlayer[];
    selectedPlayers: RosterPlayer[];
    loading: boolean;
}

export default function TradeSimulator() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<string>('');
    const [rosters, setRosters] = useState<Roster[]>([]);
    const [loading, setLoading] = useState(true);

    // Trade state
    const [team1, setTeam1] = useState<TradeParty>({ roster: null, players: [], selectedPlayers: [], loading: false });
    const [team2, setTeam2] = useState<TradeParty>({ roster: null, players: [], selectedPlayers: [], loading: false });

    // Load leagues
    useEffect(() => {
        async function loadLeagues() {
            try {
                const data = await getLeagues();
                setLeagues(data.data);
                if (data.data.length > 0) {
                    setSelectedLeague(data.data[0].league_id);
                }
            } catch (error) {
                console.error('Error loading leagues:', error);
            } finally {
                setLoading(false);
            }
        }
        loadLeagues();
    }, []);

    // Load rosters when league changes
    useEffect(() => {
        if (!selectedLeague) return;

        async function loadRosters() {
            try {
                const rostersData = await getRosters(selectedLeague);
                setRosters(rostersData.data);
                // Reset selections
                setTeam1({ roster: null, players: [], selectedPlayers: [], loading: false });
                setTeam2({ roster: null, players: [], selectedPlayers: [], loading: false });
            } catch (error) {
                console.error('Error loading rosters:', error);
            }
        }
        loadRosters();
    }, [selectedLeague]);

    // Load players when roster is selected
    async function loadRosterPlayers(team: 1 | 2, roster: Roster) {
        const setter = team === 1 ? setTeam1 : setTeam2;

        setter({ roster, players: [], selectedPlayers: [], loading: true });

        try {
            const data = await getRosterPlayers(selectedLeague, roster.roster_id);
            setter({ roster, players: data.data, selectedPlayers: [], loading: false });
        } catch (error) {
            console.error('Error loading roster players:', error);
            setter({ roster, players: [], selectedPlayers: [], loading: false });
        }
    }

    const handleAddPlayer = (team: 1 | 2, player: RosterPlayer) => {
        if (team === 1) {
            setTeam1(prev => ({
                ...prev,
                selectedPlayers: [...prev.selectedPlayers, player]
            }));
        } else {
            setTeam2(prev => ({
                ...prev,
                selectedPlayers: [...prev.selectedPlayers, player]
            }));
        }
    };

    const handleRemovePlayer = (team: 1 | 2, playerId: string) => {
        if (team === 1) {
            setTeam1(prev => ({
                ...prev,
                selectedPlayers: prev.selectedPlayers.filter(p => p.player_id !== playerId)
            }));
        } else {
            setTeam2(prev => ({
                ...prev,
                selectedPlayers: prev.selectedPlayers.filter(p => p.player_id !== playerId)
            }));
        }
    };

    const clearTrade = () => {
        setTeam1(prev => ({ ...prev, selectedPlayers: [] }));
        setTeam2(prev => ({ ...prev, selectedPlayers: [] }));
    };

    const isTradeValid = team1.roster && team2.roster &&
        team1.selectedPlayers.length > 0 && team2.selectedPlayers.length > 0;

    // Filter out selected players from available list
    const getAvailablePlayers = (party: TradeParty) => {
        const selectedIds = party.selectedPlayers.map(p => p.player_id);
        return party.players.filter(p => !selectedIds.includes(p.player_id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
            </div>
        );
    }

    // Player row component for consistent display
    const PlayerRow = ({
        player,
        onClick,
        showRemove = false,
        onRemove
    }: {
        player: RosterPlayer;
        onClick?: () => void;
        showRemove?: boolean;
        onRemove?: () => void;
    }) => (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${onClick ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : ''}`}
            style={{
                background: player.is_pick ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--bg-secondary)',
                border: player.is_pick ? '1px dashed var(--primary-500)' : 'none'
            }}
        >
            <PositionBadge position={player.position} size="sm" />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate" style={{ color: player.is_pick ? 'var(--primary-500)' : 'var(--text-primary)' }}>
                        {player.is_pick ? player.full_name : `${player.first_name} ${player.last_name}`}
                    </span>
                    {player.is_starter && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{player.team || (player.is_pick ? 'DRAFT' : 'FA')}</span>
                    {player.is_pick ? (
                        <span style={{ color: 'var(--primary-400)' }}>• Contrato Futuro</span>
                    ) : (
                        <>
                            {player.age && <span>• {player.age} anos</span>}
                            {player.years_exp !== undefined && <span>• {player.years_exp} yrs exp</span>}
                        </>
                    )}
                </div>
            </div>

            {player.injury_status && player.injury_status !== 'null' && !player.is_pick && (
                <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                    {player.injury_status}
                </span>
            )}

            {player.search_rank && player.search_rank < (player.is_pick ? 1000000 : 200) && (
                <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    #{player.is_pick ? player.search_rank - 99999 : player.search_rank}
                </span>
            )}

            {showRemove && onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                    <X className="w-4 h-4 text-red-500" />
                </button>
            )}
        </div>
    );

    // Team panel component
    const TeamPanel = ({
        team,
        party,
        otherRosterId
    }: {
        team: 1 | 2;
        party: TradeParty;
        otherRosterId?: number;
    }) => (
        <div className="card flex flex-col h-[700px]">
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Time {team}
                </h2>
                <select
                    value={party.roster?.roster_id || ''}
                    onChange={(e) => {
                        const roster = rosters.find(r => r.roster_id === Number(e.target.value));
                        if (roster) loadRosterPlayers(team, roster);
                    }}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="">Selecione um time</option>
                    {rosters
                        .filter(r => r.roster_id !== otherRosterId)
                        .map(roster => (
                            <option key={roster.roster_id} value={roster.roster_id}>
                                {roster.owner_name || `Time ${roster.roster_id}`} ({roster.wins}-{roster.losses})
                            </option>
                        ))}
                </select>
            </div>

            {/* Selected Players */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Oferecendo no trade ({party.selectedPlayers.length}):
                </p>
                {party.selectedPlayers.length === 0 ? (
                    <p className="text-sm italic py-2" style={{ color: 'var(--text-tertiary)' }}>
                        Clique nos jogadores abaixo para selecionar
                    </p>
                ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {party.selectedPlayers.map(player => (
                            <PlayerRow
                                key={player.player_id}
                                player={player}
                                showRemove
                                onRemove={() => handleRemovePlayer(team, player.player_id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Available Players */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Roster completo ({party.players.length} jogadores):
                </p>

                {party.loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--primary-500)' }} />
                    </div>
                ) : !party.roster ? (
                    <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Selecione um time acima
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {getAvailablePlayers(party).map(player => (
                            <PlayerRow
                                key={player.player_id}
                                player={player}
                                onClick={() => handleAddPlayer(team, player)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Simulador de Trades
                    </h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Simule trades entre times da sua liga
                    </p>
                </div>

                <select
                    value={selectedLeague}
                    onChange={(e) => setSelectedLeague(e.target.value)}
                    className="px-4 py-2 rounded-lg border"
                    style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)'
                    }}
                >
                    {leagues.map(league => (
                        <option key={league.league_id} value={league.league_id}>
                            {league.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6">
                {/* Team 1 */}
                <TeamPanel team={1} party={team1} otherRosterId={team2.roster?.roster_id} />

                {/* Trade Arrow */}
                <div className="flex flex-col items-center justify-center gap-4">
                    <div
                        className="p-6 rounded-full"
                        style={{ background: 'var(--bg-card)', border: '2px solid var(--border-primary)' }}
                    >
                        <ArrowLeftRight className="w-8 h-8" style={{ color: 'var(--primary-500)' }} />
                    </div>

                    {isTradeValid && (
                        <>
                            <button className="btn-primary flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Confirmar Trade
                            </button>
                            <button
                                onClick={clearTrade}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Limpar
                            </button>
                        </>
                    )}
                </div>

                {/* Team 2 */}
                <TeamPanel team={2} party={team2} otherRosterId={team1.roster?.roster_id} />
            </div>

            {/* Trade Summary */}
            {isTradeValid && (
                <div className="mt-8 card p-6">
                    <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>
                        Resumo do Trade
                    </h3>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                                {team1.roster?.owner_name || `Time ${team1.roster?.roster_id}`} recebe:
                            </p>
                            <div className="space-y-2">
                                {team2.selectedPlayers.map(player => (
                                    <div key={player.player_id} className="flex items-center gap-3">
                                        <PositionBadge position={player.position} size="sm" />
                                        <span style={{ color: player.is_pick ? 'var(--primary-500)' : 'var(--text-primary)' }}>
                                            {player.is_pick ? player.full_name : `${player.first_name} ${player.last_name}`}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {player.is_pick ? 'Draft' : player.team}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                                {team2.roster?.owner_name || `Time ${team2.roster?.roster_id}`} recebe:
                            </p>
                            <div className="space-y-2">
                                {team1.selectedPlayers.map(player => (
                                    <div key={player.player_id} className="flex items-center gap-3">
                                        <PositionBadge position={player.position} size="sm" />
                                        <span style={{ color: player.is_pick ? 'var(--primary-500)' : 'var(--text-primary)' }}>
                                            {player.is_pick ? player.full_name : `${player.first_name} ${player.last_name}`}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {player.is_pick ? 'Draft' : player.team}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
