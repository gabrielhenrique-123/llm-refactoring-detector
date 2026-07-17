import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

dotenv.config({ path: join(__dirname, "../../../../.env") });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const INPUT_PATH = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, "../json/oracleDataset.json");
const OUTPUT_PATH = process.argv[3] ? resolve(process.argv[3]) : join(__dirname, "../json/finalDataset.json");
const DELAY_MS = 300;

const MARK_DELETED = "[ARQUIVO APAGADO NESTE COMMIT — existia na versão anterior, mas foi removido]";
const MARK_CREATED = "[ARQUIVO CRIADO NESTE COMMIT — não existia na versão anterior]";
const MARK_MISSING = "[ARQUIVO NÃO ENCONTRADO NO REPOSITÓRIO NESTE COMMIT]";

console.log("Iniciando enriquecimento do dataset\n");

const raw = await readFile(INPUT_PATH, "utf-8");
const commits = JSON.parse(raw);

console.log(`Commits encontrados: ${commits.length}\n`);

if (!existsSync(dirname(OUTPUT_PATH))) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
}

const enrichedCommits = [];

for (let i = 0; i < commits.length; i++) {
  try {
    const enriched = await enrichCommit(commits[i], i, commits.length);
    enrichedCommits.push(enriched);
  } catch (err) {
    console.error(`Erro no commit ${commits[i]?.sha1?.slice(0, 7)}: ${err.message}`);
    enrichedCommits.push({
      ...commits[i],
      refactorings: commits[i].refactorings?.map((refactoring) => ({
        ...refactoring,
        codeBefore: null,
        codeAfter: null,
      })) ?? [],
    });
  }
}

await writeFile(OUTPUT_PATH, JSON.stringify(enrichedCommits, null, 2), "utf-8");
console.log(`\nConcluído! Resultado salvo em: ${OUTPUT_PATH}`);



function parseGitHubUrl(repositoryUrl) {
  const match = repositoryUrl.split("//");
  const owner = match[1].split("/")[1];
  const repo = match[1].split("/")[2].split(".")[0];
  if (!match) throw new Error(`URL de repositório inválida: ${repositoryUrl}`);
  return { 
    owner: owner, 
    repo: repo 
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      const resetAt = response.headers.get("x-ratelimit-reset");
      const waitUntil = resetAt
        ? new Date(Number(resetAt) * 1000).toLocaleTimeString()
        : "desconhecido";
      throw new Error(`Rate limit atingido. Reset em: ${waitUntil}`);
    }
    throw new Error(`GitHub API retornou ${response.status} para: ${url}`);
  }

  await sleep(DELAY_MS);
  return response.json();
}

function classNameToFilePath(qualifiedName) {
  const parts = qualifiedName.trim().split(".");
  const firstClassIdx = parts.findIndex(p => /^[A-Z]/.test(p));
  if (firstClassIdx === -1) return parts.join("/") + ".java";
  return parts.slice(0, firstClassIdx + 1).join("/") + ".java";
}

function getFilePath(type, description) {
  if (type === "Move Method") {
    const matches = [...description.matchAll(/from class ([\w.]+)/g)];
    if (matches.length < 2) return null;
    const codeBeforeFilePath = classNameToFilePath(matches[0][1]);
    const codeAfterFilePath  = classNameToFilePath(matches[matches.length - 1][1]);
    return { codeBeforeFilePath, codeAfterFilePath };
  }

  const match = description.match(/in class ([\w.]+)/);
  if (!match) return null;
  const filePath = classNameToFilePath(match[1]);
  return { codeBeforeFilePath: filePath, codeAfterFilePath: filePath };
}

function fileNameFromPath(filePath) {
  return filePath.includes("/")
    ? filePath.substring(filePath.lastIndexOf("/") + 1)
    : filePath;
}

async function getTreeBlobs(owner, repo, sha) {
  if (!sha) return [];
  const tree = await get(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`);
  return tree.tree?.filter((item) => item.type === "blob") ?? [];
}

async function resolveFileContent(owner, repo, blobs, filePath) {
  const entry = blobs.find(
    (item) => item.path === filePath || item.path.endsWith(`/${filePath}`)
  );
  if (!entry) return null;

  const blob = await get(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${entry.sha}`);
  if (!blob.content) return null;

  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

function previousPathOf(filePath, files, allowBasenameFallback) {
  const base = fileNameFromPath(filePath);
  // 1. Rename confirmado pelo GitHub → usa previous_filename
  const renamed = files.find(
    (f) => f.status === "renamed" && (f.filename === filePath || f.filename.endsWith(`/${filePath}`))
  );
  if (renamed?.previous_filename) return renamed.previous_filename;
  // 2. Move detectado como remove+add → único arquivo removido com mesmo basename
  if (allowBasenameFallback) {
    const removed = files.filter((f) => f.status === "removed" && fileNameFromPath(f.filename) === base);
    if (removed.length === 1) return removed[0].filename;
  }
  return null;
}

// Caminho do arquivo no snapshot ATUAL, dado o caminho derivado (versão antes).
// Restringe-se a renames confirmados para não mascarar arquivos genuinamente apagados.
function currentPathOf(filePath, files) {
  const renamed = files.find(
    (f) => f.status === "renamed" && (f.previous_filename === filePath || f.previous_filename?.endsWith(`/${filePath}`))
  );
  return renamed ? renamed.filename : null;
}

async function enrichRefactoring(ref, owner, repo, parentSha, sha, files) {
  const filePaths = getFilePath(ref.type, ref.description);

  if (!filePaths) {
    console.warn(`Filepath não encontrado para: ${ref.type}`);
    return { ...ref, codeBefore: null, codeAfter: null };
  }

  const { codeBeforeFilePath, codeAfterFilePath } = filePaths;

  // Arquivos envolvidos, preservando a posição (Arquivo 1 = origem, Arquivo 2 = destino).
  // Para Extract/Rename há um único arquivo (origem === destino).
  const isMove = ref.type === "Move Method";
  const involvedFiles = isMove
    ? [codeBeforeFilePath, codeAfterFilePath]
    : [codeBeforeFilePath];

  const parentBlobs  = await getTreeBlobs(owner, repo, parentSha);
  const currentBlobs = await getTreeBlobs(owner, repo, sha);

  const beforeParts = [];
  const afterParts  = [];

  for (let i = 0; i < involvedFiles.length; i++) {
    const filePath = involvedFiles[i];
    const name = fileNameFromPath(filePath);

    let beforeContent = await resolveFileContent(owner, repo, parentBlobs, filePath);
    let afterContent  = await resolveFileContent(owner, repo, currentBlobs, filePath);

    if (beforeContent === null) {
      const prevPath = previousPathOf(filePath, files, !isMove);
      if (prevPath) {
        beforeContent = await resolveFileContent(owner, repo, parentBlobs, prevPath);
        if (beforeContent !== null) {
          console.warn(`  Recuperado (arquivo renomeado) no snapshot anterior: ${filePath} <- ${prevPath}`);
        }
      }
    }
    if (afterContent === null) {
      const curPath = currentPathOf(filePath, files);
      if (curPath) {
        afterContent = await resolveFileContent(owner, repo, currentBlobs, curPath);
        if (afterContent !== null) {
          console.warn(`  Recuperado (arquivo renomeado) no snapshot atual: ${filePath} -> ${curPath}`);
        }
      }
    }

    if (beforeContent === null) {
      console.warn(`  Arquivo ausente no snapshot anterior: ${filePath}`);
    }
    if (afterContent === null) {
      console.warn(`  Arquivo ausente no snapshot atual: ${filePath}`);
    }

    const beforeBody =
      beforeContent !== null ? beforeContent
      : afterContent  !== null ? MARK_CREATED
      : MARK_MISSING;

    const afterBody =
      afterContent  !== null ? afterContent
      : beforeContent !== null ? MARK_DELETED
      : MARK_MISSING;

    if (isMove) {
      beforeParts.push(`Arquivo ${i + 1} (${name}): ${beforeBody}`);
      afterParts.push(`Arquivo ${i + 1} (${name}): ${afterBody}`);
    } else {
      beforeParts.push(beforeBody);
      afterParts.push(afterBody);
    }
  }

  return {
    ...ref,
    codeBefore: beforeParts.join(", "),
    codeAfter:  afterParts.join(", "),
  };
}

async function enrichCommit(commit, index, total) {
  const { repository, sha1, author, refactorings } = commit;
  const { owner, repo } = parseGitHubUrl(repository);

  console.log(`\n[${ index + 1}/${total}] Commit: ${sha1.slice(0, 7)} — ${author}`);

  const commitData = await get(`https://api.github.com/repos/${owner}/${repo}/commits/${sha1}`);
  const parentSha = commitData.parents?.[0]?.sha ?? null;
  const files = commitData.files ?? [];

  const enrichedRefactorings = [];
  for (let i = 0; i < refactorings.length; i++) {
    console.log(`  [${i + 1}/${refactorings.length}] ${refactorings[i].type}`);
    const enriched = await enrichRefactoring(refactorings[i], owner, repo, parentSha, sha1, files);
    enrichedRefactorings.push(enriched);
  }

  return { ...commit, refactorings: enrichedRefactorings };
}