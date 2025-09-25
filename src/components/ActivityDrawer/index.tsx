'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './ActivityDrawer.module.scss';
import { X, Bell, CheckCircle2, Loader2, AlertTriangle, Clock3, ExternalLink } from 'lucide-react';
import { useUnit } from 'effector-react';
import { $selectedAccount } from '@/wallet';
import { $network } from '@/api/connection';
import { encodeAddress } from '@polkadot/util-crypto';

type Props = { open: boolean; onClose: () => void };
type TxStatus = 'pending' | 'success' | 'failed';

type SubscanExtrinsic = {
  extrinsic_index?: string;
  block_num?: number;
  hash?: string;
  module?: string;
  call?: string;
  success?: boolean;
  fee?: string | number;
  time?: number;
};

function normalizeNetworkName(n: any) {
  if (!n) return 'polkadot';
  if (typeof n === 'string') return n.toLowerCase();
  return (n?.id ?? n?.name ?? 'polkadot').toString().toLowerCase();
}

function coretimeSubscanFor(network: any) {
  const n = normalizeNetworkName(network);
  if (n.includes('kusa'))
    return {
      api: 'https://coretime-kusama.api.subscan.io',
      site: 'https://coretime-kusama.subscan.io',
      ss58: 2,
      label: 'Coretime (Kusama)',
    };
  if (n.includes('west'))
    return {
      api: 'https://coretime-westend.api.subscan.io',
      site: 'https://coretime-westend.subscan.io',
      ss58: 42,
      label: 'Coretime (Westend)',
    };
  if (n.includes('pase'))
    return {
      api: 'https://coretime-paseo.api.subscan.io',
      site: 'https://coretime-paseo.subscan.io',
      ss58: 42,
      label: 'Coretime (Paseo)',
    };
  return {
    api: 'https://coretime-polkadot.api.subscan.io',
    site: 'https://coretime-polkadot.subscan.io',
    ss58: 0,
    label: 'Coretime (Polkadot)',
  };
}

function StatusIcon({ status }: { status: TxStatus }) {
  if (status === 'pending') return <Loader2 className={styles.spin} size={16} />;
  if (status === 'success') return <CheckCircle2 size={16} />;
  return <AlertTriangle size={16} />;
}
function StatusPill({ status }: { status: TxStatus }) {
  return <span className={`${styles.status} ${styles[status]}`}>{status}</span>;
}

export default function ActivityDrawer({ open, onClose }: Props) {
  const selectedAccount = useUnit($selectedAccount);
  const network = useUnit($network);
  const cfg = useMemo(() => coretimeSubscanFor(network), [network]);

  const address = useMemo(
    () => (selectedAccount?.address ? encodeAddress(selectedAccount.address, cfg.ss58) : undefined),
    [selectedAccount, cfg.ss58]
  );

  const [items, setItems] = useState<SubscanExtrinsic[]>([]);
  const [loading, setLoading] = useState(false);

  const SUBSCAN_API_KEY = process.env.SUBSCAN_API_KEY ?? '';

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!address) {
      setItems([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        if (!SUBSCAN_API_KEY) {
          console.warn('Missing SUBSCAN_API_KEY in your environment.');
        }

        const res = await fetch(`${cfg.api}/api/v2/scan/extrinsics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': SUBSCAN_API_KEY,
          },
          body: JSON.stringify({ row: 10, page: 0, address }),
        });

        if (!res.ok) {
          console.error('Subscan error:', res.status, await res.text());
          setItems([]);
        } else {
          const data = await res.json();
          setItems(
            Array.isArray(data?.data?.list) ? data.data.list : (data?.data?.extrinsics ?? [])
          );
        }
      } catch (e) {
        console.error('Error fetching extrinsics:', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, address, cfg.api, SUBSCAN_API_KEY]);

  const short = (s?: string, n = 8) =>
    !s ? '—' : s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;

  const when = (t?: number) => {
    if (!t) return '';
    try {
      const d = new Date(t * 1000);
      const diff = Date.now() - d.getTime();
      if (diff < 60_000) return 'Just now';
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return d.toLocaleString();
    } catch {
      return '';
    }
  };

  const explorerUrl = (ex: SubscanExtrinsic) => {
    if (ex.hash) return `${cfg.site}/extrinsic/${ex.hash}`;
    if (ex.extrinsic_index) return `${cfg.site}/extrinsic/${ex.extrinsic_index}`;
    if (ex.block_num != null) return `${cfg.site}/block/${ex.block_num}`;
    return cfg.site;
  };

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.open : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`${styles.drawer} ${open ? styles.open : ''}`}
        aria-hidden={!open}
        aria-label='Activity'
      >
        <div className={styles.header}>
          <div className={styles.titleLeft}>
            <div className={styles.bellBadge}>
              <Bell size={16} />
            </div>
            <div className={styles.titles}>
              <h3>Activity</h3>
              <p>
                {address
                  ? `Last 10 transactions · ${cfg.label} · ${short(address, 6)}`
                  : `Select an account · ${cfg.label}`}
              </p>
            </div>
          </div>
          <button className={styles.iconBtn} onClick={onClose} aria-label='Close'>
            <X size={18} />
          </button>
        </div>

        {/* In progress (placeholder) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Clock3 size={16} />
            <span>In progress</span>
          </div>
          <div className={styles.empty}>No active transactions.</div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>History</span>
          </div>

          {loading && <div className={styles.empty}>Loading…</div>}

          {!loading && (!address || items.length === 0) && (
            <div className={styles.empty}>
              {address ? 'No transactions found for this address.' : 'Please select an account.'}
            </div>
          )}

          <ul className={styles.list}>
            {items.map((ex) => {
              const status: TxStatus = ex.success ? 'success' : 'failed';
              const label = ex.module && ex.call ? `${ex.module}.${ex.call}` : 'Transaction';
              const metaParts = [
                cfg.label,
                when(ex.time),
                ex.block_num != null ? `Block ${ex.block_num}` : '',
              ].filter(Boolean);

              const url = explorerUrl(ex);

              return (
                <li key={ex.hash ?? ex.extrinsic_index ?? Math.random()} className={styles.item}>
                  <div className={styles.itemTop}>
                    <div className={styles.left}>
                      <div className={`${styles.icon} ${styles[status]}`}>
                        <StatusIcon status={status} />
                      </div>
                      <div className={styles.meta}>
                        <div className={styles.row1}>
                          <span className={styles.type}>{label}</span>
                          <StatusPill status={status} />
                        </div>
                        <div className={styles.row2}>{metaParts.join('  •  ')}</div>
                      </div>
                    </div>

                    <button
                      type='button'
                      className={styles.hashBtn}
                      title='Open in explorer'
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && window.open(url, '_blank', 'noopener,noreferrer')
                      }
                    >
                      <span>{short(ex.hash ?? ex.extrinsic_index, 8)}</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </>
  );
}
