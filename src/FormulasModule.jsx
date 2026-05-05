/* eslint-disable react-refresh/only-export-components */
// ===== COMPLETE FORMULA SYSTEM (SAFE + EXTENSIBLE) =====

import React, { useState, useMemo } from "react";
import { create, all, parse } from "mathjs";
import katex from "katex";
import "katex/dist/katex.min.css";

// ---------- MATH ENGINE ----------
const math = create(all, { number: "number", precision: 14 });

// Disable dangerous functions
math.import({
  import: () => { throw new Error("Not allowed"); },
  createUnit: () => { throw new Error("Not allowed"); },
  evaluate: () => { throw new Error("Not allowed"); },
  parse: () => { throw new Error("Not allowed"); },
  simplify: () => { throw new Error("Not allowed"); }
}, { override: true });

// ---------- SAFE EVALUATION ----------
export function evalFormula(expression, scope) {
  try {
    const compiled = math.compile(expression);
    const result = compiled.evaluate(scope);
    if (typeof result !== "number" || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// ---------- DEPENDENCY EXTRACTION ----------
export function extractDependencies(expression) {
  const node = parse(expression);
  const deps = new Set();

  node.traverse(n => {
    if (n.isSymbolNode) deps.add(n.name);
  });

  return Array.from(deps);
}

// ---------- GRAPH ----------
export function buildDependencyGraph(formulas) {
  const graph = {};
  formulas.forEach(f => {
    graph[f.name] = extractDependencies(f.expression);
  });
  return graph;
}

// ---------- TOPO SORT ----------
export function topoSort(graph) {
  const visited = new Set();
  const stack = new Set();
  const result = [];

  function visit(node) {
    if (stack.has(node)) throw new Error("Circular dependency");
    if (!visited.has(node)) {
      stack.add(node);
      (graph[node] || []).forEach(visit);
      stack.delete(node);
      visited.add(node);
      result.push(node);
    }
  }

  Object.keys(graph).forEach(visit);
  return result;
}

// ---------- COMPUTE ----------
export function computeFormulas(formulas, baseScope) {
  const graph = buildDependencyGraph(formulas);
  const order = topoSort(graph);

  const scope = { ...baseScope };
  const results = {};

  order.forEach(name => {
    const f = formulas.find(x => x.name === name);
    const val = evalFormula(f.expression, scope);
    scope[name] = val;
    results[name] = val;
  });

  return results;
}

// ---------- LATEX ----------
export function toLatex(expression) {
  try {
    return parse(expression).toTex();
  } catch {
    return expression;
  }
}

// ---------- MATH DISPLAY ----------
export function MathDisplay({ expression }) {
  const latex = toLatex(expression);

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(latex, {
          throwOnError: false
        })
      }}
    />
  );
}

// ---------- FORMULA EDITOR ----------
export function FormulaEditor({ scope, onSave }) {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const variables = Object.keys(scope);

  const handleChange = (value) => {
    setExpr(value);

    // Autocomplete
    const lastToken = value.split(/[\s()+\-*/]/).pop();
    if (lastToken.length > 0) {
      const matches = variables.filter(v =>
        v.toLowerCase().startsWith(lastToken.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5));
    } else {
      setSuggestions([]);
    }

    // Validation
    try {
      parse(value);
      setError(null);
    } catch {
      setError("Invalid expression");
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        value={expr}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="e.g. SNA - SNB"
        style={{ width: "100%", padding: 6 }}
      />

      {error && <div style={{ color: "red", fontSize: 12 }}>{error}</div>}

      {suggestions.length > 0 && (
        <div style={{ border: "1px solid #ccc", marginTop: 4 }}>
          {suggestions.map(s => (
            <div
              key={s}
              style={{ padding: 4, cursor: "pointer" }}
              onClick={() => {
                setExpr(prev => prev + s);
                setSuggestions([]);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => !error && onSave(expr)}
        disabled={!!error}
        style={{ marginTop: 6 }}
      >
        Save
      </button>
    </div>
  );
}

// ---------- MAIN PANEL ----------
export function FormulasPanel({
  formulas,
  t,
  scope,
  onAdd,
  onEdit,
  onDelete
}) {

  const results = useMemo(() => {
    return computeFormulas(formulas, scope);
  }, [formulas, scope]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Custom Formulas
      </div>

      {formulas.map(f => {
        const val = results[f.name];

        return (
          <div
            key={f.id}
            style={{
              marginBottom: 10,
              padding: 10,
              background: t.surf2,
              borderRadius: 8,
              border: `1px solid ${t.bdr}`
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, color: t.acc }}>
                  {f.name}
                </div>
                {f.unit && (
                  <div style={{ fontSize: 10 }}>{f.unit}</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => onEdit(f.id)}>Edit</button>
                <button onClick={() => onDelete(f.id)}>×</button>
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <MathDisplay expression={f.expression} />
            </div>

            <div style={{ marginTop: 6 }}>
              <strong>
                {val !== null
                  ? `${val.toFixed(2)} ${f.unit || ""}`
                  : "—"}
              </strong>
            </div>

            {f.description && (
              <div style={{ fontSize: 10, marginTop: 4 }}>
                {f.description}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={onAdd} style={{ width: "100%" }}>
        + New Formula
      </button>
    </div>
  );
}