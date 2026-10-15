'use client';

import { HandList } from '@/components/hands/HandList';

export default function HandsPage() {
  return (
    <div className="flex flex-col gap-5 max-md:gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight max-md:text-[28px] max-md:font-bold">
          <span className="md:hidden">Mains</span>
          <span className="max-md:hidden">Historique des mains</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="md:hidden">Touchez une main pour la rejouer.</span>
          <span className="max-md:hidden">Filtrez vos mains et cliquez sur une ligne pour la rejouer.</span>
        </p>
      </div>
      <HandList />
    </div>
  );
}
