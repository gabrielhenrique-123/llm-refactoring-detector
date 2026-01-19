import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Identifica refatorações entre duas versões de código-fonte utilizando uma LLM.
 *
 * @param {string} codigoAntes - Código-fonte antes da modificação
 * @param {string} codigoDepois - Código-fonte após a modificação
 * @param {string} linguagem - Linguagem de programação analisada
 * @returns {Promise<Object>} Resultado em formato JSON com as refatorações detectadas
 */
export async function identificarRefatoracoes(codigoAntes, codigoDepois, linguagem) {
  const prompt = `
You are an expert in Software Engineering and source code evolution.

Your task is to analyze changes between two versions of ${linguagem} source code and identify refactoring operations,
according to the classical definition of refactoring:

"A refactoring is a change to the internal structure of the code that does not alter its external behavior."

Analyze the changes strictly at the method level.

Focus only on the following refactoring types:
- Extract Method
- Move Method
- Rename Method

You will receive:
1. The source code BEFORE the change
2. The source code AFTER the change

Source code BEFORE:
${codigoAntes}

Source code AFTER:
${codigoDepois}

Instructions:
- Compare the two versions and identify refactorings that explain the transformation.
- Ignore changes related to new functionality, bug fixes, comments, or formatting.
- Do not infer behavior outside the provided code.
- If no refactoring is detected, return an empty list.

Output format:
Return the result strictly in JSON format, following this structure:

{
  "refactorings": [
    {
      "type": "<refactoring_type>",
      "method_before": "<method signature before the change>",
      "method_after": "<method signature after the change>",
      "description": "<brief explanation of why this refactoring applies>"
    }
  ]
}

Only return valid JSON. Do not include explanations outside the JSON output.
`;

  const resposta = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "user", content: prompt }
    ],
  });

  return JSON.parse(resposta.choices[0].message.content);
}