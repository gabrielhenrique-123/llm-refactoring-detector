import https from "https";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const filename = fileURLToPath(import.meta.url);
const dirname = dirname(filename);

dotenv.config({ path: join(dirname, '../.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function get(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "node.js",
        "Accept": "application/vnd.github.v3+json",
        "Authorization": "token " + GITHUB_TOKEN
      },
    };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 403 || res.statusCode === 429) {
          reject(new Error("Rate limit atingido."));
          return;
        }
        if (res.statusCode >= 400) {
           reject(new Error(`Erro HTTP ${res.statusCode} na URL: ${url}`));
           return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Falha ao parsear resposta: " + data));
        }
      });
    }).on("error", reject);
  });
}

function extractOwnerRepo(repoUrl) {
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) throw new Error(`URL inválida: ${repoUrl}`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

async function fetchCommitDetails(owner, repo, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
  const data = await get(url);

  const files = data.files || [];

  return {
    sha: data.sha,
    message: data.commit?.message || "",
    author: data.commit?.author?.name || "",
    date: data.commit?.author?.date || "",
    total_changes: data.stats?.total ?? 0,
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
    files_changed: files.length,
  };
}

async function fetchRepoInfo(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const data = await get(url);

  return {
    full_name: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    open_issues: data.open_issues_count,
    watchers: data.watchers_count,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

async function enrichCommit(commitData) {
  const { owner, repo } = extractOwnerRepo(commitData.repository);

  const [commitDetails, repoInfo] = await Promise.all([
    fetchCommitDetails(owner, repo, commitData.sha1),
    fetchRepoInfo(owner, repo),
  ]);

  const flatData = {
    // Dados originais
    id: commitData.id,
    repository: commitData.repository,
    sha1: commitData.sha1,
    url: commitData.url,
    original_author: commitData.author,
    original_time: commitData.time,
    refactorings_count: commitData.refactorings ? commitData.refactorings.length : 0,
    refactoring_operations: commitData.refactorings ? commitData.refactorings.map(r => r.type).join(', ') : "",
    refDiffExecutionTime: commitData.refDiffExecutionTime,

    // Dados do Repositório
    repo_full_name: repoInfo.full_name,
    repo_language: repoInfo.language,
    repo_stars: repoInfo.stars,
    repo_forks: repoInfo.forks,
    repo_open_issues: repoInfo.open_issues,
    repo_watchers: repoInfo.watchers,
    repo_created_at: repoInfo.created_at,
    repo_updated_at: repoInfo.updated_at,

    // Detalhes Específicos do Commit
    commit_message: commitDetails.message.split("\n")[0],
    commit_author: commitDetails.author,
    commit_date: commitDetails.date,
    commit_total_changes: commitDetails.total_changes,
    commit_additions: commitDetails.additions,
    commit_deletions: commitDetails.deletions,
    commit_files_changed: commitDetails.files_changed
  };

  return flatData;
}

async function processCommits() {
  const resultPath = join(dirname, 'filteredOracle.json');
  const outputPath = join(dirname, 'datasetSheet.json');
  
  if (!fs.existsSync(resultPath)) {
    console.error(`Arquivo não encontrado: ${resultPath}`);
    return;
  }

  const resultData = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
  
  const limit = 410; 
  const commitsToProcess = resultData.slice(0, limit);
  
  const enrichedCommits = [];

  console.log(`Iniciando o processamento de ${commitsToProcess.length} commits (de um total de ${resultData.length})...`);

  for (let i = 0; i < commitsToProcess.length; i++) {
    const commit = commitsToProcess[i];
    try {
      console.log(`[${i + 1}/${commitsToProcess.length}] Processando ID: ${commit.id} - ${commit.sha1.slice(0,7)}`);
      const enriched = await enrichCommit(commit);
      enrichedCommits.push(enriched);
      
      if (i < commitsToProcess.length - 1) {
        await delay(1000);
      }
    } catch (err) {
      console.error(`\nErro ao processar o commit ${commit.id}:`, err.message);

      if (err.message.includes("Rate limit")) {
        console.log("Interrompendo devido ao Rate Limit. Salvando progresso parcial...");
        break;
      }
    }
  }

  const output = JSON.stringify(enrichedCommits, null, 2);
  fs.writeFileSync(outputPath, output, "utf-8");
  console.log(`\nArquivo '${outputPath}' gerado com ${enrichedCommits.length} registros!`);
}

processCommits();