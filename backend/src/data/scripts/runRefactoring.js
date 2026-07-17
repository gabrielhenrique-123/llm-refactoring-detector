"use strict";

import { readFile, writeFile } from "fs/promises";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join, resolve } from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../../.env") });

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Prompt ───────────────────────────────────────────────────────────────────

export function buildPrompt(codigoAntes, codigoDepois) {
  return `
#CONTEXT

Two source code snapshots are provided: a BEFORE version and an AFTER version of a transformation applied to one or more Java source files. The goal is to determine whether the transformation constitutes a refactoring according to Martin Fowler's formal definitions.

#PERSONA

Act as a Software Engineering expert specializing in source code evolution, with deep knowledge of Martin Fowler's formal refactoring catalogue.

#TASK

Identify which refactoring operations, if any, were applied when transforming the BEFORE code into the AFTER code.

#REQUIREMENTS

Formal definition of refactoring (Fowler, 1999):
"Refactoring is the process of changing a software system in such a way that it does not alter the external behavior of the code yet improves its internal structure."

Recognized refactoring types, their formal definitions, mechanics, and structural signals:


Each operation below is described using Fowler's own material: his definition, the motivation
he gives for applying it, the mechanics he prescribes, and a synthetic example illustrating it.


1. Extract Method

Definition:
"You have a code fragment that can be grouped together. Turn the fragment into a method whose name explains the purpose of the method."

Motivation (Fowler):
Fowler favours short methods whose names announce their purpose. He extracts a fragment
whenever a method is longer than it ought to be, or whenever a piece of code needs a comment
to explain what it does -- in which case the comment becomes the name of the new method. The
aim is to separate the INTENTION of a piece of code (what it accomplishes, captured by the
method's name) from its IMPLEMENTATION (how it accomplishes it, now tucked inside the new
method). Code grouped this way reads at a higher level of abstraction, the named fragment can
be reused, and the smaller method is easier to understand and to override.

Mechanics:
  1. Create a new method and name it after the intention of the code (name it by what it does,
     not by how it does it).
  2. Copy the fragment of code from the source method into the body of the new method.
  3. Examine the fragment for references to variables that are local in scope to the source method:
     - a variable that the fragment only reads becomes a parameter of the new method;
     - a variable that is declared inside the fragment and still used by the source method
       afterwards must be returned by the new method;
     - if the fragment assigns to more than one variable that is needed later, the fragment is
       not straightforwardly extractable as a single method and needs further reworking first.
  4. Replace the fragment in the source method with a call to the new method, passing it the
     parameters and assigning back any returned value.
  5. Test that behaviour is unchanged.

Synthetic example:

  Before refactoring:
    class Order {

        public double computeTotal(List<Item> items) {
            double total = 0;
            for (Item item : items) {
                total += item.getPrice() * (1 - item.getDiscount());
            }
            System.out.println("Total: " + total);
            return total;
        }
    }

  After refactoring:
    class Order {

        public double computeTotal(List<Item> items) {
            double total = sumDiscountedPrices(items);
            System.out.println("Total: " + total);
            return total;
        }

        private double sumDiscountedPrices(List<Item> items) {
            double total = 0;
            for (Item item : items) {
                total += item.getPrice() * (1 - item.getDiscount());
            }
            return total;
        }
    }


2. Rename Method

Definition:
"The name of a method does not reveal its purpose. Change the name of the method."

Motivation (Fowler):
For Fowler, a method's name should reveal its intention, so a reader understands what it does
without reading its body. When the name communicates poorly -- it is cryptic, too generic, or
out of step with what the body actually does -- the name is changed to one that better
describes the method's purpose. (In the 2nd edition this is folded into "Change Function
Declaration", where Fowler notes that improving a declaration may also involve adjusting the
parameter list.)

Mechanics:
  1. Declare a method with the new name.
  2. Copy the body of the old method into the new one.
  3. Find all callers of the old method and adjust them to call the new one.
  4. Remove the old method (if it is part of a published interface, keep it as a delegating
     method instead).

Synthetic example A:

  Before refactoring:
    class Account {
        public double calc(double amount, double rate) {
            return amount * rate / 100;
        }
    }

  After refactoring:
    class Account {
        public double calculateInterest(double amount, double rate) {
            return amount * rate / 100;
        }
    }

Synthetic example B:

  Before refactoring:
    class Report {
        public List<Row> getData() {
            return rows.stream().filter(Row::isVisible).collect(toList());
        }
    }

  After refactoring:
    class Report {
        public List<Row> fetchVisibleRows() {
            return rows.stream().filter(Row::isVisible).collect(toList());
        }
    }


3. Move Method

Definition:
"A method is using or used by more features of another class than the class on which it is defined. Create a new method with a similar body in the class it uses most. Either turn the old method into a simple delegation, or remove it altogether."

Motivation (Fowler):
Fowler moves a method when it is, or will be, using or being used by the features of another
class more than those of the class on which it is currently defined. The guiding idea is to
reduce coupling by putting a method together with the data and behaviour it most depends on.
He chooses the destination by looking at where the features the method calls, and the data it
reads, actually live: the method belongs in the class it talks to most. The method itself is
already a complete, named method; what the refactoring changes is the class that hosts it.

Mechanics:
  1. Examine all the features (fields and methods) that the source method uses, and consider
     which of them should be moved along with it.
  2. Check whether the method is also declared in superclasses or subclasses of the source class.
  3. Declare the method in the target class.
  4. Copy the body of the source method into the target method and adjust it to work in its new
     home; where the method relied on data or methods of its original class, reach them through a
     field of the target class or through a parameter passed in.
  5. Decide how the target method will obtain the object it needs to operate on.
  6. Turn the source method into a delegating method that forwards to the target, or remove it
     entirely and redirect its callers to the target method.
  7. Test that behaviour is unchanged.

Synthetic example (two files provided):

  Before refactoring:
    // File 1: Customer.java
    class Customer {

        private Account account;

        public double calculateMonthlyCharge() {
            return account.getBalance() * account.getRate() / 12;
        }
    }

    // File 2: Account.java
    class Account {

        private double balance;
        private double rate;

        public double getBalance() { return balance; }
        public double getRate()    { return rate; }
    }

  After refactoring:
    // File 1: Customer.java
    class Customer {

        private Account account;

        // removed entirely, or left as a delegation:
        // public double calculateMonthlyCharge() { return account.calculateMonthlyCharge(); }
    }

    // File 2: Account.java
    class Account {

        private double balance;
        private double rate;

        public double getBalance() { return balance; }
        public double getRate()    { return rate; }

        public double calculateMonthlyCharge() {
            return balance * rate / 12;
        }
    }

#CONSTRAINTS

- Report only refactorings that strictly match the formal definitions above.
- Do not report a change as a refactoring if it introduces new logic, fixes a bug, alters behavior, or modifies the observable output of the method.
- Do not infer behavior or intent beyond what is provided in the code.
- If the same transformation can be explained by multiple types, choose the one that best represents the primary structural change.
- If no refactoring is detected, return an empty list.

#OUTPUT

Return ONLY valid JSON, with no explanations or text outside it, in the following format:

{
  "refactorings": [
    {
      "type": "<Extract Method | Rename Method | Move Method>",
      "method_before": "<full method signature as it appears in BEFORE, or null if the method did not exist>",
      "method_after": "<full method signature as it appears in AFTER, or null if the method was removed>",
      "description": "<one sentence explaining what structural transformation occurred and why it matches Fowler's definition>"
    }
  ]
}

#INPUT FORMAT

Each of the BEFORE and AFTER sections below may contain ONE or MULTIPLE Java source files.
When multiple files are present, they are concatenated in the following format:

  Arquivo 1 (FileName1.java): <full source of file 1>, Arquivo 2 (FileName2.java): <full source of file 2>, ...

#ACTION

Analyze the code snippets below and produce the output JSON.

BEFORE Code:
${codigoAntes}

AFTER Code:
${codigoDepois}
`;
}

function parseJson(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();

  // Tentativa direta — caso a resposta já seja JSON puro
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extrai o primeiro objeto JSON balanceado, ignorando
    // qualquer texto/preâmbulo que o modelo tenha colocado ao redor.
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error(`Resposta sem JSON: ${cleaned.slice(0, 120)}`);

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];

      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1));
        }
      }
    }

    throw new Error(`JSON não balanceado na resposta: ${cleaned.slice(0, 120)}`);
  }
}

async function callGpt(prompt) {
  const response = await openaiClient.chat.completions.create({
    model: "gpt-5.4",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  return parseJson(response.choices[0].message.content);
}

async function callClaude(prompt) {
  const response = await claudeClient.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  return parseJson(response.content[0].text);
}

export const MODELS = [
  { key: "gpt", call: callGpt },
  { key: "claude", call: callClaude }
];

async function identifyRefactorings(codigoAntes, codigoDepois) {
  const prompt = buildPrompt(codigoAntes, codigoDepois);

  const results = await Promise.allSettled(MODELS.map((m) => m.call(prompt)));

  return Object.fromEntries(
    MODELS.map((m, i) => {
      const outcome = results[i];
      return [
        m.key,
        outcome.status === "fulfilled"
          ? { detected: outcome.value.refactorings, error: null }
          : { detected: null, error: outcome.reason?.message ?? String(outcome.reason) },
      ];
    })
  );
}

function projectForModel(commits, modelKey) {
  return commits.map((commit) => ({
    ...commit,
    refactorings: commit.refactorings.map(({ llmResults, ...ref }) => ({
      ...ref,
      llmDetected: llmResults[modelKey].detected,
      llmError: llmResults[modelKey].error,
    })),
  }));
}

async function analyzeDataset(inputPath, outputDir, prefix = "finalAnalysis") {
  console.log(`Lendo dataset: ${inputPath}\n`);
  const raw = await readFile(inputPath, "utf-8");
  const commits = JSON.parse(raw);

  const analyzedCommits = [];

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    console.log(`\n[${i + 1}/${commits.length}] Commit: ${commit.sha1.slice(0, 7)}  (${commit.author})`);

    const analyzedRefactorings = [];

    for (let j = 0; j < commit.refactorings.length; j++) {
      const ref = commit.refactorings[j];

      if (!ref.codeBefore || !ref.codeAfter) {
        console.log(`  Refatoração ${j + 1}: codeBefore ou codeAfter ausente — pulando LLM`);
        analyzedRefactorings.push({
          ...ref,
          llmResults: Object.fromEntries(
            MODELS.map((m) => [m.key, { detected: null, error: "codeBefore ou codeAfter não disponível" }])
          ),
        });
        continue;
      }

      console.log(`  Refatoração ${j + 1}/${commit.refactorings.length}: enviando para GPT e Claude (${ref.type})`);

      const llmResults = await identifyRefactorings(ref.codeBefore, ref.codeAfter);

      for (const [model, result] of Object.entries(llmResults)) {
        if (result.error) {
          console.error(`    ${model}: erro — ${result.error}`);
        } else {
          console.log(`    ${model}: ${result.detected.length} refatoração(ões) detectada(s)`);
        }
      }

      analyzedRefactorings.push({ ...ref, llmResults });
    }

    analyzedCommits.push({ ...commit, refactorings: analyzedRefactorings });
  }

  await Promise.all(
    MODELS.map(async (m) => {
      const outputPath = join(outputDir, `${prefix}_${m.key}.json`);
      await writeFile(outputPath, JSON.stringify(projectForModel(analyzedCommits, m.key), null, 2), "utf-8");
      console.log(`Análise ${m.key} salva em: ${outputPath}`);
    })
  );
}

const entryHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryHref && import.meta.url === entryHref) {
  const inputArg = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, "../json/finalDataset.json");
  const outDirArg = process.argv[3] ? resolve(process.argv[3]) : join(__dirname, "../json");
  const prefixArg = process.argv[4] ?? "finalAnalysis";

  analyzeDataset(inputArg, outDirArg, prefixArg).catch((err) => {
    console.error("Erro fatal:", err.message);
    process.exit(1);
  });
}
