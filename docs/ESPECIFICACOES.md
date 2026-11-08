# Estante Virtual

## Visão Geral do Sistema

O projeto Estante Virtual, é uma aplicação full-stack que se trata de um gerenciador de leitura pessoal com autentificação e login, onde o usuário pode organizar, se planejar e tirar relatórios de leitura por categoria, avaliação e resenhas.

## Tecnologias utilizadas

 * **FrontEnd**
    * *HTML5 e CSS3*: Visual e estilização
    * Tailwind CSS (via CDN): Framework utilitário para estilização ágil e responsiva
    * JavaScript (Vanilla JS): Manipulação dinâmica do DOM e consumo da API via `fetch`
---

 * **BackEnd**
    * Node.js: Servidor JavaScript (ambiente de execução)
    * Express.js: Framework para criação das rotas HTTP/RESTful e middlewares
    * SQLite3: Banco de dados baseado em arquivo local
    * Bcrypt.js: Algoritmo de hash criptografico para armazenamento seguro das senhas
    * JSON Web Token (JWT): Mecanismo de autentificação sem estado para proteção de rotas privadas
---

 * **Infraestrutura e Deploy**
    * Git e GitHub: Versionamento de código e controle de commits
    * Render: Hospedagem na nuvem do servidor Web Service.
---

 * **Detalhamento da API RESTful**

 A API foi projetada seguindo a arquitetura REST, utilizando JSON para a troca de dados e cabeçalhos HTTP para controle de autentificação.
    * Endpoints da API

   | Método | Rota                      | Protegida (JWT)? | Descrição                                                         |
   |--------|---------------------------|------------------|-------------------------------------------------------------------|
   | POST   | /api/register             | Não              | Cria uma nova conta de usuário (com hash de senha via Bcrypt)     |
   | POST   | /api/login                | Não              | Autentica o usuário e retorna o Token JWT                         |
   | POST   | /api/reset-password       | Não              | Redefine a senha de um usuário via email direto do banco de dados |
   | GET    | /api/profile              | Sim              | Retorna os dados cadastrais e a meta de leitura do usuário        | 
   | PUT    | /api/profile              | Sim              | Atualiza as configurações de perfil (meta de leitura)             |
   | POST   | /api/books                | Sim              | Cadastra um novo livro na estante do usuário                      |
   | GET    | /api/books                | Sim              | Retorna a lista de livros pertencentes ao usuário autenticado     |
   | PUT    | /api/books/:id            | Sim              | Atualiza os dados de um livro existente pelo seu ID               |
   | DELETE | /api/books/:id            | Sim              | Remove um livro especifico da estante                             |
   
   **Fluxo de autenticação**
     1. Autenticação: Na rota `/api/login`, o back-end valida as credenciais e gera um token JWT contendo `id` e `email` do usuário
     2. Autorização: Para acessar as rotas de livros (`/api/books`), o cliente envia o token no cabeçalho HTTP:
        `Authorization: Bearer <TOKEN_JWT>`
     3. Middleware de proteção: Um middleware no Express intercepta a requisição, valida a assinatura do token e injeta o `userId` na requisição, garantindo que um usuário nunca consiga acessar ou alterar a estante de outro usuário.
---

 ## Modelagem de Banco de Dados 

  O projeto utiliza o SQLite3, um banco de dados relacional baseado em arquivo, eliminando a necessidade de servidores de banco dedicados para a camada gratuita.

  * Esquema das tabelas (Schema)
  * **Tabela:** `users` (Usuários)

  Armazena as informações das contas cadastradas.

  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    reading_goal INTEGER DEFAULT 12,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`

---

  * **Tabela:** `books` (Livros)

  Armazena os livros vinculados a cada usuário.

  `CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT CHECK(status IN ('Quero Ler', 'Lendo', 'Lido')) DEFAULT 'Quero Ler',
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    review TEXT,
    cover_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`

---
 
 * **Relacionamento entre entidades**
   * Tipo de relacionamento: 1 para N (1:N)
   * Regra de negócio: Um usuário pode possuir multiplos Livros cadastrados em sua estante, mas cada Livro pertence a apenas um Usuário (referenciado pela chave `user_id`)
---

## Arquitetura do sistema

 * **Paradigma de desenvolvimento**
 
  O modo de codificação escolhido foi o tradicional (Pro-Code/High-Code).

 * **Estrutura de diretórios**
    * estante-virtual
       * public/
          * index.html `interface visual e lógica Cliente-Side`
       * .gitignore `Arquivos ignorados pelo Git (node_modules, etc)`
       * databse.sqlite `Banco de dados SQLite local`
       * package.json `Dependências do ecossistema Node.js`
       * server.js `Servidor express, rotas da API e autentificação`
 ---

## Funcionalidade principais

 * **Autentificação de usuário**
    * Cadastro de novas contas com confirmação de senha, e Recuperação de senha direta
    * Login e emissão de token JWT armazenado no `localStorage`

---

* **Personalizaçõ de Perfil e Interface**
   * Modo Escuro: Suporte a tema claro e escuro com persistência da preferência no `localStorage`
   * Perfil do Usuário: Personalização de nome em exibição, avatar (foto de perfil) e meta de leitura.

---

 * **Gerenciamento de livros**
    * Create: Cadastro de livros com titulo, autor, categoria, status (se está lendo, vai ler ou se ja foi lido) nota (1 a 5) e resenha;
    * Read: Listagem personalizada vinculada apenas ao usuário autenticado (não apresenta a mesma listagem para outros usuários);
    * Update: Edição de dados do livro em modal dinâmico a qualquer momento e de forma que fique salva as novas informações;
    * Delete: Exclusão de livros com confirmação.
---

 * **Painel de estatisticas**
    * Calculo automático de total de livros, quantidade de lidos/lendo e média das notas.
    * Identificação automática de genero favorito (com base na categoria mais frequentemente cadastrada)
---

 * **Compatibilidade multiambiente**
    * Tratamento de requisições `fetch`dinâmico para alternância automática entre ambiente de desenvolvimento `localhost` e produção `Render`
---

## Instrução para Execução

 * **Pré-requisitos** 
    * Node.js instalado (recomendo versão 18 ou superior)
---

 * **Passos para rodar local**
    1. Clonar o repositório 

    `git clone https://github.com/seu-usuario/estante-virtual.git`

    2. Acessar a pasta do projeto:

    `cd estante-virtual`

    3. Instalar as dependências:

    `npm install`

    4. Iniciar o servidor:

    `node server.js`

    5. Acessar no navegador

    `http://localhost:3000`

## Créditos e Autoria

* **Estruturado, desenvolvido e testado por:** Larissa Domiciano Gesaro
* **Auxilios:** Ajuda de colegas veteranos do meu trabalho, videos no youtube, conteúdo de materias anteriores e gemini (apenas para tirar dúvidas);
* **Curso:** Engenharia de Software (7° período)
