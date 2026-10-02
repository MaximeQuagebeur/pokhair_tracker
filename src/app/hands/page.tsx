'use client';

import { HandList } from '@/components/hands/HandList';

export default function HandsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historique des mains</h1>
        <p className="text-sm text-muted-foreground">Filtrez vos mains et cliquez sur une ligne pour la rejouer.</p>
      </div>
      <HandList />
    </div>
  );
}
