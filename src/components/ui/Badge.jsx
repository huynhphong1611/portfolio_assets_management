import React from 'react';

const TX_TONES = {
  'Nạp tiền': 'green',
  'Rút tiền': 'orange',
  'Mua': 'blue',
  'Bán': 'red',
  'Cổ tức': 'violet',
};

export default function Badge({ tone = 'gray', children, title }) {
  return <span className={`pp-badge pp-badge--${tone}`} title={title}>{children}</span>;
}

/** Transaction type badge (consistent colours across views). */
export function TxTypeBadge({ type }) {
  return <Badge tone={TX_TONES[type] || 'gray'}>{type || '—'}</Badge>;
}
