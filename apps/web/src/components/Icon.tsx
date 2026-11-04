const paths: Record<string, string> = {
  car: 'M5 17H4V9l2-5h12l2 5v8h-1M5 17v3m14-3v3M4 11h16M7 14h2m6 0h2M5 17h14',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  unlock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0M12 14v3',
  key: 'M14 4a6 6 0 1 1-4 10l-6 6H2v-3l7-7a6 6 0 0 1 5-6ZM16 8h.01',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  camera: 'M3 6h5l2-3h4l2 3h5v15H3zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  calendar: 'M4 5h16v16H4zM8 2v6m8-6v6M4 10h16',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
  money: 'M3 6h18v13H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 12h.01M18 12h.01',
  chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  seats: 'M8 3H5v9a4 4 0 0 0 4 4h10v-4H9V3ZM5 16v5m13-5v5',
  settings:
    'M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2M16 8l2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  check: 'M5 12l4 4L19 6',
  alert: 'm12 3 10 18H2L12 3ZM12 9v4m0 4h.01',
  star: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z',
  clipboard: 'M9 4H4v18h16V4h-5M9 2h6v5H9zM8 12h8m-8 4h6',
  inbox: 'M4 4h16l2 12v5H2v-5L4 4ZM2 16h6l1 2h6l1-2h6',
  phone: 'M7 2h10v20H7zM10 18h4',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  signal: 'M3 9a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 15a4 4 0 0 1 6 0M12 19h.01',
};

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={name === 'star' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ui-icon ${className}`}
    >
      <path d={paths[name] || paths.check} />
    </svg>
  );
}
