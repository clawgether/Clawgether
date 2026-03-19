import { useState, useMemo } from 'react';

export default function ConfettiEffect({ active }) {
    const pieces = useMemo(() => {
        if (!active) return [];
        const colors = ['#ff2d78', '#00d4ff', '#a855f7', '#22c55e', '#f59e0b', '#f06595', '#845ef7'];
        return Array.from({ length: 60 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2,
            duration: 2 + Math.random() * 2,
            color: colors[i % colors.length],
            size: 6 + Math.random() * 8,
        }));
    }, [active]);

    if (!active) return null;

    return (
        <div className="confetti-container">
            {pieces.map(p => (
                <div
                    key={p.id}
                    className="confetti-piece"
                    style={{
                        left: `${p.left}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        backgroundColor: p.color,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                    }}
                />
            ))}
        </div>
    );
}
