'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [sidebarWidth, setSidebarWidth] = useState(256);

    useEffect(() => {
        // Check initial state
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved && JSON.parse(saved)) setSidebarWidth(64);

        // Listen for changes
        const handler = (e: CustomEvent) => {
            setSidebarWidth(e.detail ? 64 : 256);
        };
        window.addEventListener('sidebar-toggle', handler as EventListener);
        return () => window.removeEventListener('sidebar-toggle', handler as EventListener);
    }, []);

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main
                className="flex-1 p-8 transition-all duration-300"
                style={{ marginLeft: sidebarWidth }}
            >
                {children}
            </main>
        </div>
    );
}
