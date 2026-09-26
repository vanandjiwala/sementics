import React from 'react';
import { NODE_CATALOG_BY_KIND } from '../data/nodeCatalog';

const inputClass =
  'w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-muted-foreground';

function Field({ param, value, onChange }) {
  if (param.type === 'bool') {
    return (
      <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">default</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (param.type === 'select') {
    return (
      <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">default</option>
        {param.options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (param.type === 'sql') {
    return (
      <textarea
        className={`${inputClass} h-40 resize-y`}
        spellCheck={false}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  const input = (
    <input
      className={inputClass}
      type={param.type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (!param.browse) return input;
  const browse = async () => {
    const path = await (param.browse === 'open' ? window.sementics.openCsv() : window.sementics.saveCsv());
    if (path) onChange(path);
  };
  return (
    <div className="flex gap-1">
      {input}
      <button
        type="button"
        onClick={browse}
        className="shrink-0 rounded border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Browse…
      </button>
    </div>
  );
}

function Row({ param, config, onConfigChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {param.label}
        {param.required && ' *'}
      </span>
      <Field param={param} value={config[param.key]} onChange={(v) => onConfigChange(param.key, v)} />
    </label>
  );
}

export default function NodeConfigPanel({ node, inputNames, onNameChange, onConfigChange }) {
  const entry = NODE_CATALOG_BY_KIND[node.data.kind];
  const config = node.data.config ?? {};
  const required = entry.params.filter((p) => p.required);
  const optional = entry.params.filter((p) => !p.required);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-card p-3 font-mono">
      <h2 className="pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{entry.label}</h2>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Name (used as table name in SQL)</span>
          <input className={inputClass} value={node.data.name ?? ''} onChange={(e) => onNameChange(e.target.value)} />
        </label>
        {required.map((p) => (
          <Row key={p.key} param={p} config={config} onConfigChange={onConfigChange} />
        ))}
        {node.data.kind === 'sql' && (
          <p className="text-xs text-muted-foreground">
            Inputs: {inputNames.length ? inputNames.join(', ') : 'none connected'}
          </p>
        )}
        {optional.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              Options
            </summary>
            <div className="flex flex-col gap-3">
              {optional.map((p) => (
                <Row key={p.key} param={p} config={config} onConfigChange={onConfigChange} />
              ))}
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}
