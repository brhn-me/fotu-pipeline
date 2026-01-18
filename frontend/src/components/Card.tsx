import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
}

export function Card({ children, className = '' }: CardProps) {
    return (
        <div className={`bg-white shadow rounded-lg border border-gray-200 ${className}`}>
            {children}
        </div>
    );
}
