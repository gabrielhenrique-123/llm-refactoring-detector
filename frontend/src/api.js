export async function detectarRefatoracoes(codigoAntes, codigoDepois) {
  const resposta = await fetch("http://localhost:3000/api/refatoracoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigoAntes, codigoDepois })
  });

  const data = await resposta.json();
  return data.resultado;
}
