# LLM Refactoring Detector

## 📌 Sobre o Projeto

Este projeto é uma ferramenta desenvolvida para identificar operações de refatoração entre duas versões de código-fonte (Antes e Depois). Utilizando a API da OpenAI (GPT-4o-mini), o sistema analisa as mudanças estruturais e detecta refatorações clássicas como **Extract Method**, **Move Method** e **Rename Method**, independentemente da linguagem de programação.

O projeto faz parte de um trabalho acadêmico (Monografia) focado na aplicação de Modelos de Linguagem de Grande Escala (LLMs) na Engenharia de Software.

## 🚀 Funcionalidades

- **Interface Web Interativa:** Permite a inserção de código original e refatorado lado a lado.
- **Suporte Multilinguagem:** Analisa códigos em JavaScript, Python, Java e C.
- **Detecção Inteligente:** Utiliza prompts especializados para identificar refatorações sem confundir com correções de bugs ou novas funcionalidades.
- **Feedback Visual:** Exibe as refatorações detectadas de forma estruturada.

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React (Vite)
- **Backend:** Node.js com Express
- **AI:** OpenAI API (GPT-4o-mini)
- **Estilização:** CSS Vanilla

## 📂 Estrutura do Projeto

```
/
├── backend/          # Servidor Node.js e lógica de integração com LLM
│   ├── src/
│   │   ├── llm.js    # Comunicação com a OpenAI
│   │   ├── route.js  # Definição das rotas da API
│   │   └── server.js # Configuração do servidor Express
│
├── frontend/         # Aplicação React
│   ├── src/
│   │   ├── App.jsx   # Interface principal
│   │   └── api.js    # Chamadas ao backend
│
└── test/             # Casos de teste para validação
    ├── extractMethod/
    ├── moveMethod/
    └── renameMethod/
```

## ⚡ Como Rodar o Projeto

### Pré-requisitos

- Node.js instalado (v14+ recomendado)
- Uma chave de API da OpenAI

### 1. Configuração do Backend

1. Navegue até a pasta raiz e instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` na raiz com sua chave da OpenAI:
   ```env
   OPENAI_API_KEY=sua_chave_aqui
   PORT=3000
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```

### 2. Configuração do Frontend

1. Em um novo terminal, entre na pasta `frontend`:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie a aplicação React:
   ```bash
   npm run dev
   ```
4. Acesse `http://localhost:5173` no seu navegador.

## 🧪 Testes

O projeto conta com casos de teste baseados em exemplos reais de refatoração. Eles estão localizados na pasta `test/` e podem ser usados para validar a precisão do modelo.

Para utilizar os casos de teste manualmente:

1. Abra um arquivo `before` e seu correspondente `after` na pasta `test/`.
2. Copie os conteúdos para a interface web.
3. Selecione a linguagem correta.
4. Verifique se a refatoração foi identificada corretamente.
