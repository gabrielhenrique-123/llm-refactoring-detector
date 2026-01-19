import { Router } from "express";
import { identificarRefatoracoes } from "./llm.js";

const router = Router();

router.post("/refatoracoes", async (req, res) => {
  try {
    const { codigoAntes, codigoDepois, linguagem } = req.body;

    if (!codigoAntes || !codigoDepois)
      return res.status(400).json({ erro: "Ambos os códigos são obrigatórios." });

    const resultado = await identificarRefatoracoes(codigoAntes, codigoDepois, linguagem);
    return res.json({ resultado });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro interno ao identificar refatorações." });
  }
});

export default router;
