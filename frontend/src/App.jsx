import { useState } from "react";
import { detectarRefatoracoes } from "./api";
import "./App.css";

function App() {
  const [codigoAntes, setCodigoAntes] = useState("");
  const [codigoDepois, setCodigoDepois] = useState("");
  const [linguagem, setLinguagem] = useState("javascript");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviar() {
    setLoading(true);
    const res = await detectarRefatoracoes(codigoAntes, codigoDepois, linguagem);
    setResultado(res);
    setLoading(false);
  }

  return (
    <div className="container">
      <h1 className="titulo">🔎 Detector de Refatorações</h1>

      <div className="card">
        <label className="label">Linguagem:</label>
        <select
          className="select"
          value={linguagem}
          onChange={(e) => setLinguagem(e.target.value)}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="c">C</option>
        </select>

        <div className="comparacao-container">
          <div className="comparacao-item">
            <label className="label">Código Antes:</label>
            <textarea
              className="textarea error-highlight"
              value={codigoAntes}
              onChange={(e) => setCodigoAntes(e.target.value)}
              rows="20"
              placeholder="// Original code here..."
            />
          </div>

          <div className="comparacao-item">
            <label className="label">Código Depois:</label>
            <textarea
              className="textarea success-highlight"
              value={codigoDepois}
              onChange={(e) => setCodigoDepois(e.target.value)}
              rows="20"
              placeholder="// Refactored code here..."
            />
          </div>
        </div>

        <button className="botao" onClick={enviar} disabled={loading}>
          {loading ? "Analisando..." : "Detectar Refatorações"}
        </button>
      </div>

      <div className="card resultado-card">
        <h2>Resultado:</h2>
        {resultado && typeof resultado === 'object' && resultado.refactorings ? (
          <div className="lista-refatoracoes">
            {resultado.refactorings.length === 0 ? (
              <p>Nenhuma refatoração detectada.</p>
            ) : (
              resultado.refactorings.map((ref, index) => (
                <div key={index} className="item-refatoracao">
                  <h3>{ref.type}</h3>
                  <p><strong>Antes:</strong> <code>{ref.method_before}</code></p>
                  <p><strong>Depois:</strong> <code>{ref.method_after}</code></p>
                  <p>{ref.description}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <pre className="resultado">{JSON.stringify(resultado, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export default App;
