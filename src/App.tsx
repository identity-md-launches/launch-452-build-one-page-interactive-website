import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fingerprint, formatDuration, formatTimestamp, getBlock, isEthereumAddress, parseBlockNumber } from './lib/chain';
import { Fingerprint } from './components/Fingerprint';
import { Icon } from './components/Icon';

type Block = Awaited<ReturnType<typeof getBlock>>;
type Mode = 'snapshot' | 'compare';
type Field = 'address' | 'blockA' | 'blockB';
type Result = { address: string; blocks: Block[]; example?: boolean };
const EXAMPLE_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
// Recorded mainnet block data. The initial example is explicitly labelled;
// every submitted snapshot is fetched from RPC, never substituted with this data.
const EXAMPLE: Result = { address: EXAMPLE_ADDRESS, example: true, blocks: [{ number: 20000000, timestamp: 0x665ba27f, hash: '0xd24fd73f794058a3807db926d8898c6481e902b7edb91ce0d479d6760f276183', source: 'rpc' }] };
const number = (value: number) => value.toLocaleString('en-US');

function CopyButton({ value, label, onMessage }: { value: string; label: string; onMessage: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); }, [value]);
  useEffect(() => { if (copied) { const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); } }, [copied]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onMessage(`${label} copied to clipboard.`);
    } catch {
      setCopied(false);
      onMessage(`Could not copy ${label.toLowerCase()}. Select the displayed value and copy it manually.`);
    }
  }
  return <button type="button" className={`icon-button ${copied ? 'copied' : ''}`} aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`} title={copied ? 'Copied' : `Copy ${label.toLowerCase()}`} onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={16}/></button>;
}

function BlockReadout({ block, label, onMessage }: { block: Block; label: string; onMessage: (message: string) => void }) {
  return <div className="block-readout"><div className="eyebrow">{label}</div><div className="block-value"><span className="mono">{number(block.number)}</span><CopyButton value={String(block.number)} label={`${label} number`} onMessage={onMessage}/></div><time dateTime={new Date(block.timestamp * 1000).toISOString()}>{formatTimestamp(block.timestamp)}</time></div>;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('snapshot');
  const [address, setAddress] = useState(EXAMPLE_ADDRESS);
  const [blockA, setBlockA] = useState('20000000');
  const [blockB, setBlockB] = useState('20001000');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [result, setResult] = useState<Result>(EXAMPLE);
  const [comparison, setComparison] = useState<Result | null>(null);
  const [notification, setNotification] = useState({ text: '', id: 0 });
  const message = notification.text;
  const setMessage = (text: string) => setNotification(previous => ({ text, id: previous.id + 1 }));
  const controller = useRef<AbortController | null>(null);
  const invalidFocus = useRef<Field | null>(null);
  const currentResult = mode === 'snapshot' ? result : comparison;
  const resultAddress = currentResult?.address ?? (isEthereumAddress(address.trim()) ? address.trim() : EXAMPLE_ADDRESS);
  const fingerprintCode = fingerprint(resultAddress).code;
  const dirty = currentResult && !currentResult.example && (address.trim().toLowerCase() !== currentResult.address.toLowerCase() || parseBlockNumber(blockA) !== currentResult.blocks[0].number || (mode === 'compare' && parseBlockNumber(blockB) !== currentResult.blocks[1]?.number));
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (invalidFocus.current) { document.getElementById(invalidFocus.current)?.focus(); invalidFocus.current = null; }
  }, [errors]);

  function changeMode(next: Mode) {
    if (next === mode) return;
    controller.current?.abort();
    controller.current = null;
    setLoading(false); setMode(next); setErrors({}); setRequestError(''); setMessage('');
  }
  function clearError(field: Field) { setErrors(previous => ({ ...previous, [field]: undefined })); setRequestError(''); }
  function example() {
    controller.current?.abort(); controller.current = null;
    setLoading(false); setAddress(EXAMPLE_ADDRESS); setBlockA('20000000'); setBlockB('20001000'); setErrors({}); setRequestError('');
    setMessage('Example values filled in. Create a snapshot or compare blocks to look them up.');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const next: Partial<Record<Field, string>> = {};
    const parsedA = parseBlockNumber(blockA); const parsedB = parseBlockNumber(blockB);
    if (!isEthereumAddress(address.trim())) next.address = 'Enter 0x followed by 40 hexadecimal characters.';
    if (parsedA === null) next.blockA = 'Enter a whole block number from 0 to 9007199254740991.';
    if (mode === 'compare' && parsedB === null) next.blockB = 'Enter a whole block number from 0 to 9007199254740991.';
    setErrors(next); setRequestError(''); setMessage('');
    if (Object.keys(next).length) {
      invalidFocus.current = Object.keys(next)[0] as Field;
      setMessage(`Check the form. ${Object.values(next).join(' ')}`);
      return;
    }
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true);
    try {
      const blocks = await Promise.all((mode === 'compare' ? [parsedA!, parsedB!] : [parsedA!]).map(value => getBlock(value, request.signal)));
      if (controller.current !== request || request.signal.aborted) return;
      const nextResult = { address: address.trim(), blocks };
      if (mode === 'compare') setComparison(nextResult); else setResult(nextResult);
      setMessage(mode === 'compare' ? `Comparison ready. ${number(Math.abs(blocks[1].number - blocks[0].number))} blocks and ${formatDuration(Math.abs(blocks[1].timestamp - blocks[0].timestamp))} apart.` : `Snapshot ready for block ${number(blocks[0].number)}. ${formatTimestamp(blocks[0].timestamp)}.`);
    } catch (error) {
      if (controller.current !== request || request.signal.aborted) return;
      setRequestError(error instanceof Error ? error.message : 'Unable to retrieve the block. Check your connection and try again.');
    } finally {
      if (controller.current === request) { setLoading(false); controller.current = null; }
    }
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="app-shell">
      <header className="site-header">
        <a href="#" className="brand" aria-label="Chain Time Machine home" onClick={() => changeMode('snapshot')}><span className="brand-icon"><Icon name="orbit" size={31}/></span><span>chain<span className="brand-secondary">time machine</span></span><span className="version mono">v1.0</span></a>
        <nav aria-label="Main navigation"><a href="#explorer" className={mode === 'snapshot' ? 'nav-active' : ''} onClick={() => changeMode('snapshot')}>Explorer</a><a href="#how-it-works">How it works <Icon name="external" size={12}/></a></nav>
        <div className="network-pill"><span className="status-dot"/> Ethereum mainnet</div>
      </header>
      <main id="main">
        <section className="intro" aria-labelledby="page-title">
          <div><div className="eyebrow intro-kicker"><span className="tiny-cross">+</span> A different kind of block explorer</div><h1 id="page-title">Every address.<br/><span>A moment in time.</span></h1><p>Travel through Ethereum. Turn any address and block into<br className="desktop-break"/> a visual snapshot of a moment on the chain.</p></div>
          <div className="intro-aside"><div className="mini-orbit" aria-hidden="true"><Icon name="orbit" size={52}/></div><span className="mono">Past blocks.<br/>New perspectives.</span><div className="aside-coordinate mono">ETH / TIME / IDENTITY</div></div>
        </section>
        <section id="explorer" className="workspace" aria-label="Ethereum time explorer">
          <div className="control-panel">
            <div className="section-marker"><span className="mono">01 /</span><span>Set your coordinates</span></div>
            <div className="mode-switch" role="group" aria-label="Explorer mode"><button type="button" aria-pressed={mode === 'snapshot'} onClick={() => changeMode('snapshot')}><Icon name="block" size={17}/> Snapshot</button><button type="button" aria-pressed={mode === 'compare'} onClick={() => changeMode('compare')}><Icon name="compare" size={17}/> Compare blocks</button></div>
            <form onSubmit={submit} noValidate>
              <div className="field-group"><div className="label-row"><label htmlFor="address">Ethereum address</label><span className="mono field-tag">0x</span></div><input id="address" name="address" className="address-input mono" value={address} onChange={event => { setAddress(event.target.value); clearError('address'); }} placeholder="0x…" spellCheck={false} autoComplete="off" autoCapitalize="none" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'address-error' : 'address-hint'}/>{errors.address ? <p id="address-error" className="field-error">{errors.address}</p> : <p id="address-hint" className="field-hint">Any public Ethereum address. No connection needed.</p>}</div>
              <div className={`block-inputs ${mode === 'compare' ? 'two' : ''}`}>
                <div className="field-group"><label htmlFor="blockA">{mode === 'compare' ? 'First block' : 'Block number'}</label><div className="input-with-icon"><span aria-hidden="true">#</span><input id="blockA" name="blockA" className="mono" inputMode="numeric" value={blockA} onChange={event => { setBlockA(event.target.value); clearError('blockA'); }} placeholder="20000000" autoComplete="off" aria-invalid={Boolean(errors.blockA)} aria-describedby={errors.blockA ? 'blockA-error' : 'block-hint'}/></div>{errors.blockA && <p id="blockA-error" className="field-error">{errors.blockA}</p>}</div>
                {mode === 'compare' && <div className="field-group"><label htmlFor="blockB">Second block</label><div className="input-with-icon"><span aria-hidden="true">#</span><input id="blockB" name="blockB" className="mono" inputMode="numeric" value={blockB} onChange={event => { setBlockB(event.target.value); clearError('blockB'); }} placeholder="20001000" autoComplete="off" aria-invalid={Boolean(errors.blockB)} aria-describedby={errors.blockB ? 'blockB-error' : 'block-hint'}/></div>{errors.blockB && <p id="blockB-error" className="field-error">{errors.blockB}</p>}</div>}
              </div>
              <p id="block-hint" className="field-hint block-hint">{mode === 'compare' ? 'Two points in time. Enter blocks in either order.' : 'Choose a moment. Every block has a story.'}</p>
              <button className="primary-button" type="submit" disabled={loading}><span>{loading && <span className="spinner"/>}{mode === 'snapshot' ? 'Create snapshot' : 'Compare blocks'}{loading && <span className="sr-only"> — loading</span>}</span><Icon name="arrow" size={19}/></button>
              {loading && <p className="loading-message" role="status">Reading Ethereum block data…</p>}
              {requestError && <div className="request-error" role="alert"><Icon name="info" size={18}/><div><strong>Block lookup failed</strong><p>{requestError}</p><span>Check the block number, then try again.</span></div></div>}
              {!loading && !requestError && currentResult && !currentResult.example && !dirty && <p className="success-message"><Icon name="check" size={14}/>{mode === 'compare' ? 'Comparison ready below.' : 'Snapshot ready to explore.'}</p>}
              <p className="try-example">Just exploring? <button type="button" onClick={example}>Try an example <span aria-hidden="true">↗</span></button></p>
            </form>
            <div className="privacy-note"><Icon name="shield" size={17}/><span>Public data. No wallet. Just curiosity.</span></div>
          </div>
          <div className="result-panel" aria-busy={loading}>
            <div className="section-marker result-marker"><div><span className="mono">02 /</span><span>{mode === 'snapshot' ? 'Your moment, captured' : 'The space between'}</span></div><span className="preview-label mono">{loading ? 'Retrieving…' : currentResult?.example ? 'Example preview' : currentResult ? (mode === 'compare' ? 'Comparison ready' : 'Snapshot ready') : 'Ready to compare'}</span></div>
            <article className={`snapshot-card ${mode === 'compare' ? 'comparison-card' : ''}`} aria-label={mode === 'snapshot' ? 'Snapshot card' : 'Block comparison'}>
              <div className="card-topline"><span className="eyebrow"><svg aria-hidden="true" width="12" height="18" viewBox="0 0 12 20" fill="currentColor"><path d="m6 0 6 10-6 3-6-3zm0 15 6-3-6 8-6-8z"/></svg> Ethereum</span><span className="mono card-serial">CTM / {fingerprintCode.slice(0, 8).toUpperCase()}</span></div>
              <div className="art-stage"><span className="art-label mono">Address fingerprint</span><Fingerprint address={resultAddress}/><div className="art-axis mono"><span>0x / {resultAddress.slice(-4).toUpperCase()}</span><span>Deterministic by design</span></div></div>
              {mode === 'compare' && !comparison ? <div className="compare-empty"><h2>Two blocks. One timeline.</h2><p>Choose two block numbers and compare their exact timestamps.</p></div> : <div className="card-data">
                <div className="address-readout"><div className="eyebrow">Ethereum address</div><div className="address-value"><span className="mono" dir="ltr">{currentResult?.address}</span><CopyButton value={currentResult!.address} label="Ethereum address" onMessage={setMessage}/></div></div>
                {mode === 'snapshot' ? <div className="snapshot-metadata"><BlockReadout block={result.blocks[0]} label="Block" onMessage={setMessage}/><a className="explorer-link" href={`https://etherscan.io/block/${result.blocks[0].number}`} target="_blank" rel="noreferrer" aria-label="View block on Etherscan (opens in a new tab)"><Icon name="external" size={18}/></a></div> : comparison && <><div className="comparison-blocks"><BlockReadout block={comparison.blocks[0]} label="First block" onMessage={setMessage}/><span className="comparison-connector" aria-hidden="true"><Icon name="compare" size={19}/></span><BlockReadout block={comparison.blocks[1]} label="Second block" onMessage={setMessage}/></div><div className="difference"><div><span className="eyebrow">Blocks apart</span><strong className="mono">{number(Math.abs(comparison.blocks[1].number - comparison.blocks[0].number))}</strong></div><div><span className="eyebrow">Time elapsed</span><strong className="mono">{formatDuration(Math.abs(comparison.blocks[1].timestamp - comparison.blocks[0].timestamp))}</strong></div></div></>}
              </div>}
              <div className="card-bottomline"><span><span className="status-dot"/>{currentResult?.example ? 'Example · recorded block data' : currentResult ? 'Timestamp from Ethereum' : 'Waiting for your coordinates'}</span><Icon name="orbit" size={17}/></div>
            </article>
            <div className="result-caption"><Icon name={dirty ? 'info' : 'spark'} size={14}/><span>{dirty ? 'Inputs changed. Submit again to update this result.' : 'Same address. Same fingerprint. A different moment in time.'}</span></div>
          </div>
        </section>
        <section id="how-it-works" className="how-it-works" aria-label="How it works"><div className="feature"><div className="feature-heading"><Icon name="orbit" size={21}/><h2>An identity in every address</h2></div><p>Your address becomes a distinctive visual fingerprint, generated locally and consistently.</p></div><div className="feature"><div className="feature-heading"><Icon name="clock" size={21}/><h2>Real blocks. Real moments.</h2></div><p>Each snapshot pairs your address with a block’s timestamp. Compare two to see the time between.</p></div><div className="feature"><div className="feature-heading"><Icon name="shield" size={21}/><h2>Explore without connecting</h2></div><p>No wallet, signatures, or private keys. Your address stays in your browser; only blocks are looked up.</p></div></section>
        <div className="live-message" role="status" aria-live="polite" aria-atomic="true">{message && <><Icon name="info" size={16}/><span key={notification.id}>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setMessage('')}><Icon name="close" size={16}/></button></>}</div>
      </main>
      <footer><span>Chain Time Machine <span className="footer-separator">/</span> A little perspective on Ethereum.</span><span className="mono">Made for the curious <span aria-hidden="true">↗</span></span></footer>
    </div>
  </>;
}
