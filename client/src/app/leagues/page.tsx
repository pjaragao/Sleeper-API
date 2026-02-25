'use client';

import { useState, useEffect } from 'react';
import { getLeagues, addLeague, deleteLeague, League } from '@/lib/api';
import { Trophy, Plus, RefreshCw, ChevronRight, AlertCircle, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LeaguesPage() {
    const router = useRouter();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newLeagueId, setNewLeagueId] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadLeagues();
    }, [ownerName]);

    async function loadLeagues() {
        try {
            const data = await getLeagues({ grouped: true, ownerName });
            setLeagues(data.data);
        } catch (error) {
            console.error('Error loading leagues:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddLeague() {
        if (!newLeagueId.trim()) return;

        setAdding(true);
        setError('');

        try {
            await addLeague(newLeagueId.trim());
            setNewLeagueId('');
            setShowAddModal(false);
            await loadLeagues();
        } catch (err: any) {
            setError('Erro ao adicionar liga. Verifique o ID e tente novamente.');
        } finally {
            setAdding(false);
        }
    }

    async function handleDeleteLeague(leagueId: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm('Tem certeza? Isso apagará TODAS as informações dessa liga.')) return;

        try {
            await deleteLeague(leagueId);
            setLeagues(prev => prev.filter(l => l.league_id !== leagueId));
        } catch (error) {
            console.error('Error deleting league:', error);
            alert('Erro ao excluir liga');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Minhas Ligas
                    </h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Gerencie suas ligas do Sleeper
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            type="text"
                            placeholder="Filtrar por nome do manager..."
                            className="pl-9 pr-4 py-2 rounded-lg border text-sm w-64"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar Liga
                    </button>
                </div>
            </div>

            {leagues.length === 0 ? (
                <div className="card p-12 text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Nenhuma liga cadastrada
                    </h2>
                    <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                        Adicione uma liga do Sleeper para começar
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar Liga
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leagues.map((league) => (
                        <div
                            key={league.league_id}
                            onClick={() => router.push(`/leagues/${league.league_id}`)}
                            className="card p-6 hover:scale-[1.02] transition-transform cursor-pointer relative group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    🏈
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span
                                        className="px-3 py-1 rounded-full text-xs font-medium"
                                        style={{
                                            background: league.status === 'in_season' ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                                            color: league.status === 'in_season' ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {league.status === 'in_season' ? 'Em andamento' :
                                            league.status === 'pre_draft' ? 'Pré-draft' : league.status}
                                    </span>
                                    <button
                                        onClick={(e) => handleDeleteLeague(league.league_id, e)}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Excluir liga"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                                {league.name}
                            </h3>

                            <div className="flex flex-col gap-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <span>{league.total_rosters} times</span>
                                {(league as any).season_count > 1 ? (
                                    <span className="font-medium text-[var(--primary-500)]">
                                        {(league as any).season_count} temporadas ({(league as any).start_year} - {(league as any).end_year})
                                    </span>
                                ) : (
                                    <span>Temporada {league.season}</span>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
                                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    Ver detalhes
                                </span>
                                <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add League Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card p-6 w-full max-w-md m-4 animate-fadeIn">
                        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Adicionar Liga
                        </h2>

                        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Cole o ID da liga do Sleeper. Você pode encontrar o ID na URL do Sleeper:
                            <br />
                            <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                                sleeper.app/leagues/<strong>LEAGUE_ID</strong>
                            </code>
                        </p>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg flex items-center gap-2 bg-red-500/10 text-red-500">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <input
                            type="text"
                            value={newLeagueId}
                            onChange={(e) => setNewLeagueId(e.target.value)}
                            placeholder="Ex: 1312694161610113024"
                            className="w-full px-4 py-3 rounded-lg border mb-4"
                            style={{
                                background: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)'
                            }}
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowAddModal(false); setError(''); }}
                                className="btn-secondary flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddLeague}
                                disabled={adding || !newLeagueId.trim()}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                {adding ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
