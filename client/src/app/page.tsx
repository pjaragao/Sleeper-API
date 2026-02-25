'use client';

import { useEffect, useState } from 'react';
import { getStatus, getLeagues, Status, League } from '@/lib/api';
import { Trophy, Users, Calendar, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statusData, leaguesData] = await Promise.all([
          getStatus(),
          getLeagues({ grouped: true })
        ]);
        setStatus(statusData);
        setLeagues(leaguesData.data);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-500)' }} />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
        Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'var(--primary-500)' }}
            >
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ligas</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {status?.leagues || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'var(--accent-success)' }}
            >
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Jogadores</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {status?.players?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-lg"
              style={{ background: 'var(--accent-info)' }}
            >
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>NFL Week</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {status?.nflState?.week || '-'} <span className="text-sm font-normal">({status?.nflState?.season})</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leagues List */}
      <div className="card">
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Minhas Ligas
            </h2>
            <Link href="/leagues" className="btn-primary text-sm">
              Ver Todas
            </Link>
          </div>
        </div>

        {leagues.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma liga cadastrada.</p>
            <Link href="/leagues" className="btn-primary mt-4 inline-block">
              Adicionar Liga
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
            {leagues.map((league) => (
              <Link
                key={league.league_id}
                href={`/leagues/${league.league_id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--bg-secondary)]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  >
                    🏈
                  </div>
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {league.name}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {league.total_rosters} times • {(league as any).season_count > 1 ?
                        `${(league as any).season_count} temporadas (${(league as any).start_year}-${(league as any).end_year})` :
                        league.season}
                    </p>
                  </div>
                </div>
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
