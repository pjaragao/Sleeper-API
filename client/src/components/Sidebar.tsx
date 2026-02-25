'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import {
    LayoutDashboard,
    Trophy,
    Users,
    ArrowLeftRight,
    RefreshCw,
    Sparkles,
    History,
    Settings,
    FileSpreadsheet,
    Target,
    Wrench,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/leagues', label: 'Ligas', icon: Trophy },
    { href: '/players', label: 'Jogadores', icon: Users },
    { href: '/drafts', label: 'Drafts', icon: FileSpreadsheet },
    { href: '/mock-draft', label: 'Mock Draft', icon: Target },
    { href: '/draft-tools', label: 'Ferramentas', icon: Wrench },
    { href: '/trade-simulator', label: 'Simulador', icon: ArrowLeftRight },
    { href: '/trades', label: 'Histórico', icon: History },
    { href: '/manage', label: 'Gerenciar', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    // Persist state
    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved) setCollapsed(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
        // Dispatch event for layout to listen
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: collapsed }));
    }, [collapsed]);

    return (
        <aside
            className={`fixed left-0 top-0 h-screen flex flex-col border-r transition-all duration-300 z-50 ${collapsed ? 'w-16' : 'w-64'
                }`}
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)'
            }}
        >
            {/* Logo */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
                <Link href="/" className="flex items-center gap-2 overflow-hidden">
                    <Sparkles className="w-8 h-8 flex-shrink-0" style={{ color: 'var(--primary-500)' }} />
                    {!collapsed && (
                        <div className="min-w-0">
                            <h1 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                Sleeper Assistant
                            </h1>
                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                Fantasy AI
                            </p>
                        </div>
                    )}
                </Link>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-16 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors z-10"
                style={{
                    background: 'var(--primary-500)',
                    color: 'white'
                }}
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg transition-all ${collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'
                                }`}
                            style={{
                                background: isActive ? 'var(--primary-500)' : 'transparent',
                                color: isActive ? 'white' : 'var(--text-secondary)',
                            }}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div
                className={`p-3 border-t flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}
                style={{ borderColor: 'var(--border-primary)' }}
            >
                <ThemeToggle />
                {!collapsed && (
                    <button
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        title="Sincronizar dados"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                )}
            </div>
        </aside>
    );
}

// Export hook for other components to know sidebar state
export function useSidebarWidth() {
    const [width, setWidth] = useState(256);

    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved && JSON.parse(saved)) setWidth(64);

        const handler = (e: CustomEvent) => {
            setWidth(e.detail ? 64 : 256);
        };
        window.addEventListener('sidebar-toggle', handler as EventListener);
        return () => window.removeEventListener('sidebar-toggle', handler as EventListener);
    }, []);

    return width;
}
