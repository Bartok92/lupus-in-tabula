import { useId, type ReactNode } from 'react';

// Illustrazioni originali dei ruoli: sagome controluce davanti alla luna piena,
// con un solo dettaglio colorato per ruolo. Tutte in viewBox 200×200.

const SAGOMA = '#070914';
const BORDO_LUCE = 'rgb(228 232 242 / 0.35)';
const ORO = '#f0c65a';
const ROSSO = '#ff4a3d';

type Figura = (id: string) => ReactNode;

const FIGURE: Record<string, Figura> = {
  /** Non è un ruolo: la luna che dorme, per la schermata di chi aspetta di notte. */
  notte: () => (
    <>
      <path d="M78 84 Q100 100 122 84" stroke={SAGOMA} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M84 91 l-4 6 M92 94.5 l-2 7 M100 96 v7 M108 94.5 l2 7 M116 91 l4 6" stroke={SAGOMA} strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M14 172 V142 L36 124 L58 142 V172 Z M60 172 V132 L76 94 L92 132 V172 Z M94 172 V146 L116 128 L138 146 V172 Z M140 172 V138 L163 120 L186 138 V172 Z"
        fill={SAGOMA}
        stroke={BORDO_LUCE}
      />
    </>
  ),

  lupo: () => (
    <>
      <path
        d="M112 166 L107 144 L103 166 L84 166 Q86 160 92 158 L94 122 Q93 100 97 84 Q95 68 90 57 L80 48 L87 45 L77 35 Q84 36 90 41 L100 52 Q107 59 113 62 L115 51 L120 65 Q129 80 133 98 Q140 118 141 138 Q149 154 158 149 Q164 145 161 139 Q171 147 165 159 Q157 169 139 167 Z"
        fill={SAGOMA}
        stroke={BORDO_LUCE}
      />
      <circle cx="100" cy="58" r="1.8" fill={ROSSO} />
    </>
  ),

  veggente: (id) => (
    <>
      <defs>
        <radialGradient id={`${id}-sfera`} cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.5" stopColor={ORO} />
          <stop offset="1" stopColor="#8a5a12" />
        </radialGradient>
      </defs>
      <path d="M62 168 Q66 128 82 112 Q84 84 100 72 Q116 84 118 112 Q134 128 138 168 Z" fill={SAGOMA} stroke={BORDO_LUCE} />
      <circle cx="96" cy="96" r="1.4" fill={ORO} />
      <circle cx="104" cy="96" r="1.4" fill={ORO} />
      <g opacity="0.22">
        <circle cx="100" cy="138" r="26" fill={ORO} className="pulsa" />
      </g>
      <circle cx="100" cy="138" r="14" fill={`url(#${id}-sfera)`} />
      <ellipse cx="85" cy="146" rx="7" ry="4.5" fill={SAGOMA} />
      <ellipse cx="115" cy="146" rx="7" ry="4.5" fill={SAGOMA} />
      <path d="M58 118 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z M142 104 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill={ORO} opacity="0.8" />
    </>
  ),

  villico: () => (
    <>
      <g opacity="0.25">
        <circle cx="68" cy="128" r="16" fill={ORO} className="fiammella" />
      </g>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M80 168 L84 118 Q86 104 100 102 Q114 104 116 118 L120 168 Z" />
        <circle cx="100" cy="90" r="11" />
        <path d="M83 82 Q100 76 117 82 Q100 86 83 82 Z M91 81 Q92 69 100 69 Q108 69 109 81 Z" />
      </g>
      <path d="M86 120 L71 124" stroke={SAGOMA} strokeWidth="7" strokeLinecap="round" />
      <path d="M114 120 L128 112" stroke={SAGOMA} strokeWidth="7" strokeLinecap="round" />
      <rect x="64" y="122" width="8" height="11" rx="1.5" fill={ORO} />
      <path d="M64 122 Q68 116 72 122" stroke={SAGOMA} strokeWidth="1.5" fill="none" />
      <g stroke={SAGOMA} strokeWidth="3" strokeLinecap="round">
        <path d="M128.5 168 V50" />
        <path d="M120 50 H137 M120 50 V36 M128.5 50 V32 M137 50 V36" />
      </g>
    </>
  ),

  guardia: () => (
    <>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M76 168 L82 118 Q86 102 100 100 Q114 102 118 118 L124 168 Z" />
        <path d="M89 94 Q89 74 100 71 Q111 74 111 94 L108 98 H92 Z" />
        <rect x="134" y="40" width="3" height="128" />
        <path d="M135.5 24 L142 42 H129 Z" />
      </g>
      <path d="M76 114 H124 V136 Q124 158 100 172 Q76 158 76 136 Z" fill="#0d1230" stroke="#aeb7cc" strokeWidth="2" />
      <path d="M104 124 A14 14 0 1 0 104 152 A11 11 0 1 1 104 124 Z" fill="#aeb7cc" />
      <path d="M100 76 V92" stroke={BORDO_LUCE} />
    </>
  ),

  gufo: () => (
    <>
      <path d="M14 152 Q100 140 186 154 L186 160 Q100 148 14 159 Z" fill={SAGOMA} stroke={BORDO_LUCE} />
      <path
        d="M78 150 Q70 118 80 98 Q84 86 90 81 L85 64 L97 76 Q100 75 103 76 L115 64 L110 81 Q116 86 120 98 Q130 118 122 150 Z"
        fill={SAGOMA}
        stroke={BORDO_LUCE}
      />
      <circle cx="91" cy="95" r="8" fill={ORO} />
      <circle cx="109" cy="95" r="8" fill={ORO} />
      <circle cx="91" cy="95" r="3.5" fill={SAGOMA} />
      <circle cx="109" cy="95" r="3.5" fill={SAGOMA} />
      <path d="M100 101 L96 106 H104 Z" fill="#8a5a12" />
      <path d="M88 120 Q100 128 112 120 M90 132 Q100 139 110 132" stroke={BORDO_LUCE} fill="none" />
      <path d="M92 150 v6 M96 150 v6 M104 150 v6 M108 150 v6" stroke={SAGOMA} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  medium: () => (
    <>
      <path d="M118 104 C140 86 118 66 144 50 C158 42 152 30 142 33" stroke="#e4e8f2" strokeWidth="3" fill="none" opacity="0.45" strokeLinecap="round" />
      <ellipse cx="146" cy="40" rx="9" ry="11" fill="#e4e8f2" opacity="0.35" />
      <circle cx="143" cy="38" r="1.5" fill={SAGOMA} />
      <circle cx="149" cy="38" r="1.5" fill={SAGOMA} />
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M72 168 Q76 130 88 116 Q90 98 100 92 Q110 98 112 116 Q124 130 128 168 Z" />
        <circle cx="100" cy="84" r="10" />
        <path d="M89 86 Q88 70 100 70 Q112 70 111 86 L114 104 L100 94 L86 104 Z" />
      </g>
      <g opacity="0.3">
        <circle cx="115" cy="111" r="12" fill={ORO} className="fiammella" />
      </g>
      <rect x="112.5" y="116" width="5" height="14" fill="#e4e8f2" />
      <path d="M115 106 Q119 111 115 115 Q111 111 115 106 Z" fill={ORO} />
      <path d="M104 128 L113 124" stroke={SAGOMA} strokeWidth="6" strokeLinecap="round" />
    </>
  ),

  massone: () => (
    <>
      <g stroke={ORO} strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M100 38 L85 70 M100 38 L115 70" />
        <path d="M86 58 L100 72 L114 58" />
      </g>
      <circle cx="100" cy="37" r="2.5" fill={ORO} />
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M50 168 Q54 132 66 118 Q68 96 78 88 Q88 96 90 118 Q98 132 102 168 Z" />
        <path d="M98 168 Q102 132 114 118 Q116 96 126 88 Q136 96 138 118 Q146 132 150 168 Z" />
      </g>
      <circle cx="75" cy="104" r="1.3" fill={ORO} />
      <circle cx="81" cy="104" r="1.3" fill={ORO} />
      <circle cx="123" cy="104" r="1.3" fill={ORO} />
      <circle cx="129" cy="104" r="1.3" fill={ORO} />
    </>
  ),

  indemoniato: () => (
    <>
      <path
        d="M58 168 Q56 120 70 100 Q70 76 84 66 L76 42 L92 60 Q100 57 108 60 L124 42 L116 66 Q130 76 130 100 Q144 120 142 168 Z"
        fill="#3a0d12"
        opacity="0.9"
      />
      <circle cx="91" cy="80" r="2.4" fill={ROSSO} />
      <circle cx="109" cy="80" r="2.4" fill={ROSSO} />
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M83 168 L86 128 Q88 116 100 114 Q112 116 114 128 L117 168 Z" />
        <circle cx="100" cy="102" r="10.5" />
      </g>
    </>
  ),

  mitomane: () => (
    <>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M78 168 L82 126 Q84 112 96 110 Q108 112 110 126 L114 168 Z" />
        <circle cx="96" cy="98" r="10.5" />
      </g>
      <path d="M108 126 L121 110" stroke={SAGOMA} strokeWidth="6.5" strokeLinecap="round" />
      <path d="M120 96 L121 111" stroke="#8a5a12" strokeWidth="2.5" />
      <path d="M108 76 Q108 64 121 64 Q134 64 134 76 Q134 92 121 97 Q108 92 108 76 Z" fill="#e4e8f2" stroke={ORO} strokeWidth="1.5" />
      <ellipse cx="115.5" cy="77" rx="3" ry="1.8" fill={SAGOMA} />
      <ellipse cx="126.5" cy="77" rx="3" ry="1.8" fill={SAGOMA} />
      <path d="M114 86 Q121 91 128 86" stroke={SAGOMA} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),

  cartomante: () => (
    <>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M68 150 Q70 120 84 108 Q86 88 100 80 Q114 88 116 108 Q130 120 132 150 Z" />
        <path d="M36 150 H164 V157 H36 Z" />
        <path d="M46 157 V170 M154 157 V170" strokeWidth="4" />
      </g>
      <circle cx="95" cy="100" r="1.4" fill={ORO} />
      <circle cx="105" cy="100" r="1.4" fill={ORO} />
      <g stroke={ORO} strokeWidth="1.5" fill="#1a1030">
        <rect x="76" y="126" width="15" height="22" rx="2" transform="rotate(-16 83 137)" />
        <rect x="109" y="126" width="15" height="22" rx="2" transform="rotate(16 116 137)" />
        <rect x="92.5" y="120" width="15" height="22" rx="2" />
      </g>
      <path d="M103 126 A5 5 0 1 0 103 136 A4 4 0 1 1 103 126 Z" fill={ORO} />
    </>
  ),

  mucca: () => (
    <>
      <g fill="#d8d2c0">
        <path d="M84 66 Q70 58 70 42 Q80 54 92 60 Z" />
        <path d="M116 66 Q130 58 130 42 Q120 54 108 60 Z" />
      </g>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M76 130 Q68 150 64 168 H136 Q132 150 124 130 Z" />
        <ellipse cx="64" cy="82" rx="11" ry="5" transform="rotate(-18 64 82)" />
        <ellipse cx="136" cy="82" rx="11" ry="5" transform="rotate(18 136 82)" />
        <path d="M72 88 Q72 66 100 62 Q128 66 128 88 Q128 104 122 116 Q118 134 100 138 Q82 134 78 116 Q72 104 72 88 Z" />
      </g>
      <ellipse cx="100" cy="122" rx="17" ry="11" fill="#141a38" />
      <circle cx="93" cy="121" r="2.2" fill={SAGOMA} />
      <circle cx="107" cy="121" r="2.2" fill={SAGOMA} />
      <circle cx="88" cy="90" r="2.6" fill={ROSSO} />
      <circle cx="112" cy="90" r="2.6" fill={ROSSO} />
      <path d="M92 131 L94 140 L96 131 Z M104 131 L106 140 L108 131 Z" fill="#e4e8f2" />
    </>
  ),

  mortovivo: () => (
    <>
      <g opacity="0.35">
        <circle cx="146" cy="84" r="10" fill="#9fe0b0" className="fiammella" />
      </g>
      <circle cx="146" cy="84" r="3.5" fill="#c9f5d4" />
      <path d="M112 168 V112 Q112 96 130 96 Q148 96 148 112 V168 Z" fill="#0d1230" stroke="#aeb7cc" strokeWidth="1.5" />
      <path d="M130 108 V132 M122 116 H138" stroke="#aeb7cc" strokeWidth="2" strokeLinecap="round" />
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <path d="M76 170 L78 120 L90 120 L92 170 Z" />
        <path d="M74 122 Q72 106 76 100 L90 100 Q96 106 93 122 Z" />
      </g>
      <g stroke={SAGOMA} strokeWidth="5" strokeLinecap="round">
        <path d="M77 101 L72 84 M81.5 100 L80 79 M86 100 L88 80 M90 102 L96 87 M92 113 L102 105" />
      </g>
      <ellipse cx="86" cy="170" rx="46" ry="7" fill="#04060d" />
    </>
  ),

  criceto: () => (
    <>
      <g fill={SAGOMA} stroke={BORDO_LUCE}>
        <circle cx="81" cy="76" r="8" />
        <circle cx="119" cy="76" r="8" />
        <ellipse cx="100" cy="134" rx="36" ry="34" />
        <circle cx="100" cy="98" r="25" />
        <ellipse cx="86" cy="166" rx="10" ry="4" />
        <ellipse cx="114" cy="166" rx="10" ry="4" />
      </g>
      <circle cx="91" cy="94" r="2.6" fill={ROSSO} />
      <circle cx="109" cy="94" r="2.6" fill={ROSSO} />
      <path d="M95 107 L97 116 L99 107 Z M101 107 L103 116 L105 107 Z" fill="#e4e8f2" />
      <ellipse cx="88" cy="128" rx="6" ry="4" fill={SAGOMA} stroke={BORDO_LUCE} />
      <ellipse cx="112" cy="128" rx="6" ry="4" fill={SAGOMA} stroke={BORDO_LUCE} />
    </>
  ),
};

/** Sigillo generico per i ruoli ancora senza illustrazione (e per i ruoli personalizzati). */
function sigillo(nome: string): ReactNode {
  return (
    <>
      <circle cx="100" cy="118" r="34" fill={SAGOMA} stroke={BORDO_LUCE} strokeWidth="2" />
      <text x="100" y="131" textAnchor="middle" fontFamily="Cinzel Decorative, serif" fontSize="38" fill={ORO}>
        {nome.charAt(0).toUpperCase()}
      </text>
    </>
  );
}

export function haIllustrazione(id: string): boolean {
  return id in FIGURE;
}

/** Illustrazione di un ruolo con il fondale comune (cielo, luna, terreno). */
export function Illustrazione({ id, nome = '', className = '', riempi = false }: { id: string; nome?: string; className?: string; riempi?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const figura = FIGURE[id];
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio={riempi ? 'xMidYMid slice' : undefined}
      className={className}
      role="img"
      aria-label={nome ? `Illustrazione: ${nome}` : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-cielo`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1026" />
          <stop offset="1" stopColor="#23306a" />
        </linearGradient>
        <radialGradient id={`${uid}-luna`} cx="0.42" cy="0.38">
          <stop offset="0" stopColor="#fbfaf3" />
          <stop offset="0.75" stopColor="#d6dcea" />
          <stop offset="1" stopColor="#aab3c8" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${uid}-cielo)`} />
      <circle cx="100" cy="90" r="62" fill={`url(#${uid}-luna)`} />
      <circle cx="80" cy="70" r="7" fill="#8f98ae" opacity="0.18" />
      <circle cx="122" cy="104" r="10" fill="#8f98ae" opacity="0.15" />
      <path d="M0 200 V170 Q50 160 100 164 T200 162 V200 Z" fill="#04060d" />
      {figura ? figura(uid) : sigillo(nome)}
    </svg>
  );
}

/** Dorso della carta: uguale per tutti. */
export function DorsoCarta({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 250 350" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${uid}-f`} cx="0.5" cy="0.45">
          <stop offset="0" stopColor="#23306a" />
          <stop offset="1" stopColor="#070a18" />
        </radialGradient>
        <pattern id={`${uid}-p`} width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M12.5 3 L14 11 L22 12.5 L14 14 L12.5 22 L11 14 L3 12.5 L11 11 Z" fill="#d4af37" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="250" height="350" fill={`url(#${uid}-f)`} />
      <rect width="250" height="350" fill={`url(#${uid}-p)`} />
      <circle cx="125" cy="175" r="62" fill="none" stroke="#d4af37" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="125" cy="175" r="54" fill="none" stroke="#d4af37" strokeOpacity="0.3" />
      <path d="M140 132 A44 44 0 1 0 140 218 A36 36 0 1 1 140 132 Z" fill="#e4e8f2" />
      <circle cx="146" cy="160" r="2.5" fill="#ff4a3d" />
      <circle cx="160" cy="160" r="2.5" fill="#ff4a3d" />
    </svg>
  );
}
