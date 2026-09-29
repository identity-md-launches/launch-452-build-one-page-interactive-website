import { useId, useMemo } from 'react';
import { fingerprint } from '../lib/chain';

// A deterministic torus: 3D cross-sections projected into a flat SVG.
// Address bytes control its tilt, radius, wave, and phase. No random runtime state.
export function Fingerprint({ address, small = false }: { address: string; small?: boolean }) {
  const id = useId().replaceAll(':', '');
  const data = useMemo(() => fingerprint(address), [address]);
  const paths = useMemo(() => {
    const tilt = data.rings[0].tilt;
    const phase = data.rings[1].rotation / 180;
    const wave = 4 + data.rings[2].thickness * 4;
    const major = 92 + data.rings[3].opacity * 15;
    return Array.from({ length: 72 }, (_, ring) => {
      const u = ring / 72 * Math.PI * 2;
      const points = Array.from({ length: 85 }, (_, point) => {
        const v = point / 84 * Math.PI * 2;
        const tube = 48 + wave * Math.sin(u * 3 + phase * 6);
        const radial = major + tube * Math.cos(v);
        const x = radial * Math.cos(u);
        const y = radial * Math.sin(u);
        const z = tube * Math.sin(v);
        const yy = y * Math.sin(tilt) - z * Math.cos(tilt);
        const rotation = -.65 + data.rings[4].rotation / 300;
        return `${point === 0 ? 'M' : 'L'}${(240 + x * Math.cos(rotation) - yy * Math.sin(rotation)).toFixed(2)},${(170 + x * Math.sin(rotation) + yy * Math.cos(rotation)).toFixed(2)}`;
      });
      return points.join(' ') + ' Z';
    });
  }, [data]);
  return <svg className={`fingerprint-art ${small ? 'small' : ''}`} viewBox="0 0 480 340" role="img" aria-label={`Deterministic orbital fingerprint ${data.code} for address ${address}`}>
    <defs>
      <linearGradient id={`ink-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e6ffdf"/><stop offset=".48" stopColor="#93e1c0"/><stop offset="1" stopColor="#3d7d71"/></linearGradient>
      <radialGradient id={`glow-${id}`}><stop stopColor="#75dbb5" stopOpacity=".11"/><stop offset="1" stopColor="#75dbb5" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="240" cy="177" rx="219" ry="151" fill={`url(#glow-${id})`}/>
    <g fill="none" stroke={`url(#ink-${id})`} strokeWidth=".8" opacity=".85">{paths.map((path, i) => <path d={path} key={i}/>)}</g>
    <g fill="none" stroke="#7ab39c" strokeWidth=".7" opacity=".4"><ellipse cx="240" cy="176" rx="208" ry="101" transform="rotate(-23 240 176)"/><path d="M35 170h21m-10-10v20M424 170h21m-10-10v20"/></g>
    <circle cx="428" cy="105" r="3" fill="#b8f5d1"/>
  </svg>;
}
