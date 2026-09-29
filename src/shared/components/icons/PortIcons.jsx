import React from 'react';

const RED_BOX = '#b43333';
const YELLOW = '#f2c14b';
const HULL = '#1e3558';
const INK = '#1c2430';
const BOX_ORANGE = '#f08a3e';
const BOX_BLUE = '#3b82c4';

export const EQUIPMENT_COLORS = {
  vessel: HULL,
  barge: BOX_ORANGE,
  STS: '#22d3ee',
  RTG: '#14b8a6',
  RS: '#06b6d4',
  EH: '#0891b2',
  truck: '#f2c14b',
};

function Icon({ size = 22, title, vb = '0 0 64 48', children }) {
  const [, , w, h] = vb.split(' ').map(Number);
  return (
    <svg
      className="port-icon"
      width={(size * w) / h}
      height={size}
      viewBox={vb}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const REV = '5';

function Photo({ src, w, h, size = 22, title, className }) {
  const height = className ? undefined : size;
  const width = className ? undefined : Math.round((size * w) / h);
  return (
    <img
      className={className || 'port-icon'}
      src={`${src}?v=${REV}`}
      width={width}
      height={height}
      alt={title || ''}
      draggable={false}
    />
  );
}

export function PortLogo() {
  return <Photo className="port-logo" src="/icons/sts.png" w={310} h={238} title="Cẩu STS" />;
}

export function IconVessel({ size, title }) {
  return (
    <Icon size={size} title={title} vb="0 0 72 40">
      <path d="M4 28 h52 l4 6 H8 z" fill={HULL} stroke={INK} strokeWidth="1.4" />
      <rect x="40" y="14" width="8" height="12" fill="#f8fafc" stroke={INK} strokeWidth="1.2" />
      <rect x="12" y="20" width="6" height="8" fill={BOX_ORANGE} stroke={INK} strokeWidth="0.8" />
      <rect x="18" y="18" width="6" height="10" fill={BOX_BLUE} stroke={INK} strokeWidth="0.8" />
      <rect x="24" y="20" width="6" height="8" fill={YELLOW} stroke={INK} strokeWidth="0.8" />
      <rect x="30" y="22" width="6" height="6" fill="#e11d48" stroke={INK} strokeWidth="0.8" />
    </Icon>
  );
}

export function IconBarge({ size, title }) {
  return (
    <Icon size={size} title={title} vb="0 0 72 36">
      <path d="M3 24 h62 l-2 6 H6 z" fill={BOX_ORANGE} stroke={INK} strokeWidth="1.4" />
      <rect x="8" y="14" width="10" height="10" fill={BOX_BLUE} stroke={INK} strokeWidth="0.9" />
      <rect x="19" y="12" width="10" height="12" fill={RED_BOX} stroke={INK} strokeWidth="0.9" />
      <rect x="30" y="14" width="10" height="10" fill={YELLOW} stroke={INK} strokeWidth="0.9" />
      <rect x="41" y="15" width="10" height="9" fill={BOX_ORANGE} stroke={INK} strokeWidth="0.9" />
    </Icon>
  );
}

export function IconSts({ size, title }) {
  return <Photo src="/icons/sts.png" w={310} h={238} size={size} title={title} />;
}

export function IconRtg({ size, title }) {
  return <Photo src="/icons/rtg.png" w={190} h={216} size={size} title={title} />;
}

export function IconRs({ size, title }) {
  return <Photo src="/icons/rs.png" w={193} h={178} size={size} title={title} />;
}

export function IconEh({ size, title }) {
  return <Photo src="/icons/eh.png" w={161} h={155} size={size} title={title} />;
}

export function IconTruck({ size, title }) {
  return <Photo src="/icons/truck.png" w={220} h={78} size={size} title={title} />;
}

export function FlagVietnam({ className = 'lang-flag' }) {
  return (
    <svg className={className} viewBox="0 0 30 20" role="img" aria-label="Việt Nam">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon
        fill="#FFCD00"
        points="15,3.2 16.7,8.2 22,8.2 17.7,11.3 19.4,16.4 15,13.4 10.6,16.4 12.3,11.3 8,8.2 13.3,8.2"
      />
    </svg>
  );
}

export function FlagUnitedKingdom({ className = 'lang-flag' }) {
  return (
    <svg className={className} viewBox="0 0 30 20" role="img" aria-label="United Kingdom">
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 L30 20 M30 0 L0 20" stroke="#C8102E" strokeWidth="2" />
      <path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0 V20 M0 10 H30" stroke="#C8102E" strokeWidth="3.2" />
    </svg>
  );
}

export const EQUIPMENT_ICONS = {
  STS: IconSts,
  RTG: IconRtg,
  RS: IconRs,
  EH: IconEh,
};
