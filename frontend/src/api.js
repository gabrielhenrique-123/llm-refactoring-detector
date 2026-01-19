export async function detectarRefatoracoes(codigoAntes, codigoDepois, linguagem) {
  const resposta = await fetch("http://localhost:3000/api/refatoracoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigoAntes, codigoDepois, linguagem })
  });

  const data = await resposta.json();
  return data.resultado;
}
