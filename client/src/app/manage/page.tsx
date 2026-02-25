'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus, Check, AlertCircle, ChevronRight, LayoutDashboard, UserCheck, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface SleeperUser {
    user_id: string;
    username: string;
    display_name: string;
    avatar: string;
    sleeper_leagues?: number;
    imported_leagues?: number;
}

interface SleeperLeague {
    league_id: string;
    name: string;
    season: string;
    total_rosters: number;
    is_imported?: boolean;
}

export default function ManageLeaguesPage() {
    const [username, setUsername] = useState('');
    const [user, setUser] = useState<SleeperUser | null>(null);
    const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
    const [importedUsers, setImportedUsers] = useState<SleeperUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [importResults, setImportResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});
    const [syncHistory, setSyncHistory] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [managerSearch, setManagerSearch] = useState('');
    const [nflState, setNflState] = useState<any>(null);
    const [selectedSeason, setSelectedSeason] = useState('2024');
    const [syncStatus, setSyncStatus] = useState<{ syncing: boolean; message: string } | null>(null);

    useEffect(() => {
        loadImportedUsers();
        fetchNFLState();
    }, []);

    const fetchNFLState = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/nfl-state`);
            const data = await res.json();
            setNflState(data);
            setSelectedSeason(data.league_season || data.season || '2024');
        } catch (e) {
            console.error('Error fetching NFL state:', e);
        }
    };

    const loadImportedUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/users/imported`);
            const data = await res.json();
            setImportedUsers(data.data || []);
        } catch (error) {
            console.error('Error loading imported users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const searchUser = async (targetUsername?: string) => {
        const queryName = targetUsername || username;
        if (!queryName) return;

        setLoading(true);
        setUser(null);
        setLeagues([]);
        setImportResults({});
        setSelectedIds(new Set());

        try {
            const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/users/search/${queryName}`);
            if (!userRes.ok) throw new Error('Usuário não encontrado');
            const userData = await userRes.json();
            setUser(userData);

            const leaguesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/users/${userData.user_id}/leagues/${selectedSeason}`);
            const leaguesData = await leaguesRes.json();
            setLeagues(leaguesData.data || []);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === leagues.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(leagues.map(l => l.league_id)));
        }
    };

    const importLeague = async (leagueId: string) => {
        setImporting(leagueId);
        setImportResults(prev => ({ ...prev, [leagueId]: 'pending' }));

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/leagues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueId, syncHistory })
            });

            if (res.ok) {
                setImportResults(prev => ({ ...prev, [leagueId]: 'success' }));

                // Update local leagues state to reflect import
                setLeagues(prev => prev.map(l =>
                    l.league_id === leagueId ? { ...l, is_imported: true } : l
                ));

                loadImportedUsers();
            } else {
                setImportResults(prev => ({ ...prev, [leagueId]: 'error' }));
            }
        } catch (error) {
            setImportResults(prev => ({ ...prev, [leagueId]: 'error' }));
        } finally {
            setImporting(null);
        }
    };

    const importSelected = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setImporting('all');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/leagues/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leagueIds: ids, syncHistory })
            });
            const data = await res.json();

            const newResults: any = {};
            data.results.forEach((r: any) => {
                newResults[r.id] = r.status;
            });
            setImportResults(prev => ({ ...prev, ...newResults }));

            // Update local leagues state
            setLeagues(prev => prev.map(l =>
                newResults[l.league_id] === 'success' ? { ...l, is_imported: true } : l
            ));

            loadImportedUsers();
        } catch (error) {
            alert('Erro no import bulk');
        } finally {
            setImporting(null);
        }
    };

    const deleteLeague = async (leagueId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Tem certeza? Isso apagará TODAS as informações dessa liga (times, confrontos, trocas, etc).')) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/leagues/${leagueId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Remove from imported user count locally to reflect change immediately
                setImportResults(prev => {
                    const next = { ...prev };
                    delete next[leagueId];
                    return next;
                });

                // Update local leagues state
                setLeagues(prev => prev.map(l =>
                    l.league_id === leagueId ? { ...l, is_imported: false } : l
                ));

                loadImportedUsers(); // Refresh counts properly
            } else {
                alert('Erro ao excluir liga');
            }
        } catch (error) {
            console.error('Error deleting league:', error);
            alert('Erro ao excluir liga');
        }
    };

    const filteredManagers = importedUsers.filter(u =>
        u.display_name?.toLowerCase().includes(managerSearch.toLowerCase()) ||
        u.username?.toLowerCase().includes(managerSearch.toLowerCase())
    );

    return (
        <div className="animate-fadeIn max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Gerenciar Ligas
                    </h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Monitore managers e importe novas ligas
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={async () => {
                            if (importing === 'global_sync') return;
                            setImporting('global_sync');
                            setSyncStatus({ syncing: true, message: 'Iniciando sincronização...' });
                            try {
                                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/sync/all-leagues`, { method: 'POST' });
                                if (res.ok) {
                                    setSyncStatus({ syncing: true, message: 'Sincronizando ligas em background...' });
                                    // Poll for sync status every 3 seconds
                                    const pollInterval = setInterval(async () => {
                                        try {
                                            const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/status`);
                                            const statusData = await statusRes.json();
                                            if (statusData.lastSync?.status === 'completed') {
                                                setSyncStatus({ syncing: false, message: `Sincronização concluída!` });
                                                clearInterval(pollInterval);
                                                setTimeout(() => setSyncStatus(null), 5000);
                                                loadImportedUsers();
                                            } else if (statusData.lastSync?.status === 'failed') {
                                                setSyncStatus({ syncing: false, message: 'Erro na sincronização' });
                                                clearInterval(pollInterval);
                                            }
                                        } catch (e) {
                                            // Keep polling
                                        }
                                    }, 3000);
                                    // Auto-clear after 2 minutes max
                                    setTimeout(() => {
                                        setSyncStatus(null);
                                        setImporting(null);
                                    }, 120000);
                                } else {
                                    setSyncStatus({ syncing: false, message: 'Erro ao iniciar sincronização' });
                                }
                            } catch (e) {
                                setSyncStatus({ syncing: false, message: 'Erro de rede ao sincronizar' });
                            } finally {
                                setImporting(null);
                            }
                        }}
                        className="btn-secondary text-sm flex items-center gap-2"
                        disabled={importing === 'global_sync'}
                    >
                        <RefreshCw className={`w-4 h-4 ${importing === 'global_sync' ? 'animate-spin' : ''}`} />
                        Sincronizar Tudo
                    </button>
                    <Link href="/" className="btn-secondary text-sm flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                </div>
            </div>

            {/* Sync Status Banner */}
            {syncStatus && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${syncStatus.syncing ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                    {syncStatus.syncing && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                    {!syncStatus.syncing && <Check className="w-5 h-5 text-green-500" />}
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{syncStatus.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Manager Table */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b space-y-4" style={{ borderColor: 'var(--border-primary)' }}>
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2">
                                    <UserCheck className="w-5 h-5 text-[var(--primary-500)]" />
                                    Managers no Sistema
                                </h3>
                                <span className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] opacity-70">
                                    {importedUsers.length} total
                                </span>
                            </div>

                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                                <input
                                    type="text"
                                    placeholder="Filtrar managers..."
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-[var(--primary-500)]"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                                    value={managerSearch}
                                    onChange={(e) => setManagerSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Manager</th>
                                        <th className="px-4 py-3 font-semibold text-xs">Ligas Sleeper ({nflState?.league_season || '2026'})</th>
                                        <th className="px-4 py-3 font-semibold">Ligas Importadas</th>
                                        <th className="px-4 py-3 font-semibold text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                                    {loadingUsers ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-sm opacity-50">
                                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                Carregando managers...
                                            </td>
                                        </tr>
                                    ) : filteredManagers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-sm opacity-50">
                                                Nenhum manager encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredManagers.map(u => (
                                            <tr
                                                key={u.user_id}
                                                className={`hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer ${user?.user_id === u.user_id ? 'bg-[var(--primary-500)]/5 border-l-2 border-l-[var(--primary-500)]' : ''}`}
                                                onClick={() => { setUsername(u.display_name); searchUser(u.user_id); }}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center font-bold text-[var(--primary-500)]">
                                                            {u.display_name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{u.display_name}</p>
                                                            <p className="text-xs opacity-50">@{u.username || 'anonimo'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[var(--primary-500)]">{u.sleeper_leagues}</span>
                                                        <span className="text-[10px] opacity-40 uppercase tracking-tighter">Ligas</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.imported_leagues! > 0 ? 'bg-green-500/10 text-green-500' : 'bg-[var(--bg-tertiary)] opacity-30'}`}>
                                                        {u.imported_leagues}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <ChevronRight className="w-4 h-4 ml-auto opacity-30" />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-[var(--primary-500)]" />
                            Buscar Novo Manager
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    placeholder="Sleeper Username..."
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border text-lg outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                                />
                            </div>
                            <select
                                className="px-4 py-3 rounded-xl border text-lg font-bold outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(e.target.value)}
                            >
                                {[
                                    nflState?.league_season,
                                    nflState?.league_create_season,
                                    '2026', '2025', '2024', '2023', '2022', '2021', '2020'
                                ]
                                    .filter((v, i, a) => v && a.indexOf(v) === i) // Unique & Non-null
                                    .sort((a, b) => Number(b) - Number(a)) // Sort descending
                                    .map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                            </select>
                            <button
                                onClick={() => searchUser()}
                                disabled={loading}
                                className="btn-primary px-8 rounded-xl flex items-center gap-2"
                            >
                                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Buscar'}
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={syncHistory}
                                    onChange={(e) => setSyncHistory(e.target.checked)}
                                    className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--primary-500)]"
                                />
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Importar Histórico (Temporadas Anteriores)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Right Column: League Selection/Details */}
                <div className="lg:col-span-1">
                    {loading ? (
                        <div className="card p-12 flex flex-col items-center justify-center text-center opacity-50">
                            <RefreshCw className="w-12 h-12 animate-spin mb-4 text-[var(--primary-500)]" />
                            <p>Buscando ligas...</p>
                        </div>
                    ) : user ? (
                        <div className="space-y-6 animate-slideUp">
                            <div className="card p-4">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-[var(--primary-500)] flex items-center justify-center text-white text-xl font-bold">
                                        {user.display_name?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.display_name}</h2>
                                        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>@{user.username}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-50 mb-2">
                                        <span>Ligas Disponíveis</span>
                                        <span>{leagues.length}</span>
                                    </div>

                                    <div className="flex items-center justify-between mb-2">
                                        <button
                                            onClick={toggleAll}
                                            className="text-xs font-bold text-[var(--primary-500)] hover:underline"
                                        >
                                            {selectedIds.size === leagues.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                        </button>
                                    </div>

                                    <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                        {leagues.map(league => (
                                            <div
                                                key={league.league_id}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedIds.has(league.league_id) ? 'border-[var(--primary-500)] bg-[var(--primary-500)]/5' : 'hover:border-[var(--primary-500)]/50'}`}
                                                onClick={() => toggleSelection(league.league_id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(league.league_id) ? 'bg-[var(--primary-500)] border-[var(--primary-500)]' : 'border-[var(--border-primary)]'}`}>
                                                        {selectedIds.has(league.league_id) && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{league.name}</p>
                                                        <p className="text-[10px] opacity-50">{league.season} • {league.total_rosters} times</p>
                                                    </div>
                                                    {league.is_imported || importResults[league.league_id] === 'success' ? (
                                                        <button
                                                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
                                                            onClick={(e) => deleteLeague(league.league_id, e)}
                                                            title="Excluir Liga e Dados"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        importResults[league.league_id] === 'success' && <Check className="w-4 h-4 text-green-500" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={importSelected}
                                        disabled={importing === 'all' || selectedIds.size === 0}
                                        className="w-full mt-4 btn-primary py-3 rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {importing === 'all' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        {importing === 'all' ? 'Importando...' : `Importar Selecionadas (${selectedIds.size})`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card p-12 flex flex-col items-center justify-center text-center opacity-30">
                            <Users className="w-16 h-16 mb-4" />
                            <p className="text-sm">Selecione um manager na tabela ou faça uma nova busca para ver as ligas.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
