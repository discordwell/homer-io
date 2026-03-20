import { useState } from 'react';
import { DispatchBoard } from '../components/DispatchBoard.js';
import { AutoDispatchPanel } from '../components/dispatch/AutoDispatchPanel.js';
import { Pill } from '../components/Pill.js';
import { C, F } from '../theme.js';

type Tab = 'manual' | 'ai';

export function DispatchPage() {
  const [tab, setTab] = useState<Tab>('manual');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Dispatch</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>
            {tab === 'manual' ? 'Drag orders to assign them to drivers' : 'Let AI auto-assign orders to available drivers'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Pill active={tab === 'manual'} onClick={() => setTab('manual')}>
          Manual
        </Pill>
        <Pill active={tab === 'ai'} onClick={() => setTab('ai')}>
          AI Dispatch
        </Pill>
      </div>

      {tab === 'manual' ? (
        <DispatchBoard />
      ) : (
        <div style={{ maxWidth: 480 }}>
          <AutoDispatchPanel />
        </div>
      )}
    </div>
  );
}
