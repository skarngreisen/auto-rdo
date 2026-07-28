# RDO Auto — PWA para Preenchimento de Relatorio Diario de Obras

Aplicativo web progressivo (PWA) para supervisores de campo preencherem o RDO diretamente no celular, eliminando papel e digitacao manual. Hospedado via **GitHub Pages**.

---

## Pre-requisitos

- Conta no [Supabase](https://supabase.com) (plano gratuito)
- Projeto Supabase criado
- Navegador moderno (Chrome, Firefox, Safari, Edge)

---

## Configuracao

### 1. Banco de Dados

1. Acesse o **SQL Editor** do seu projeto Supabase.
2. Cole e execute o conteudo completo de `seed.sql`.
3. Isso criara as tabelas `profiles`, `projetos` e `rdos`, com politicas RLS e dados de teste.

### 2. Storage (Bucket de Fotos)

O bucket **nao pode ser criado via SQL**. Faca manualmente:

1. No Dashboard do Supabase, va em **Storage**.
2. Clique em **New Bucket**.
3. Nome: `fotos`
4. Marque **Public bucket** (para que as URLs das fotos sejam acessiveis).
5. File size limit: `5 MB`.
6. Allowed MIME types: `image/jpeg, image/png, image/webp`.

### 3. Auth (Supabase Authentication)

1. No Dashboard do Supabase, va em **Authentication > Providers**.
2. Habilite **Email/Password** (desmarque "Confirm email" para testes).
3. Crie usuarios manualmente ou use o fluxo de cadastro do app.

### 4. Credenciais

Edite as constantes no topo de `main.js`:

```js
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUA_CHAVE";
```

A mesma URL e chave tambem estao em `admin.html`. Substitua em ambos os arquivos.

---

## Como Testar

### Localmente

Abra `index.html` diretamente no navegador (nao precisa de servidor). Para acessar o painel admin, abra `admin.html`.

### GitHub Pages

O projeto esta configurado para deploy via GitHub Pages. Apos push na branch principal, acesse:

```
https://SEU_USERNAME.github.io/rdo-auto/
https://SEU_USERNAME.github.io/rdo-auto/admin.html
```

---

## Estrutura do Projeto

```
rdo-auto/
├── index.html          # App principal: auth, selecao de projeto, formulario RDO, fotos, visualizacao
├── admin.html          # Painel admin: projetos, RDOs (revisao/aprovacao/PDF/exclusao), usuarios
├── main.js             # Logica do app: auth, navegacao, formulario, submissao, PDF, fotos
├── styles.css          # Estilos compartilhados do app principal
├── seed.sql            # Criacao das tabelas + dados de teste + politicas RLS
├── package.json        # Dependencias dev (pg para scripts auxiliares)
├── .gitignore          # Exclui .env.local e node_modules
├── .env.local          # Credenciais locais (nao commitado)
├── README.md           # Este arquivo
├── docs/
│   ├── estrutura_referencia.md   # Schema extraido da planilha original
│   └── lacunas-bdo.md            # Analise de lacunas do BDO atual
└── references/
    └── RDOs Artesano.xlsx        # Planilhas originais de referencia
```

---

## Funcionalidades

### Autenticacao e Perfis
- Login/cadastro via Supabase Auth (email + senha)
- Perfis com papeis: `colaborador`, `supervisor`, `admin`
- Perfil criado automaticamente no primeiro login
- Splash screen com logo ao entrar

### Preenchimento do RDO
- Selecao do projeto (dropdown) ou criacao de novo projeto
- Data do RDO configurada no inicio do preenchimento
- Secoes condicionais ativadas por toggle Sim/Nao:
  - **Perfuracao**: striplog (tabela metro a metro), brocas (atual/anterior), estratigrafia, anomalias, coluna BHA
  - **Fluidos**: parametros do fluido + tabela de quimicos
  - **Materiais**: tabela de consumo de insumos
- Abas independentes: **Operacoes**, **Revestimento**, **Combustivel**, **Equipe**
- Pre-preenchimento automatico a partir do RDO anterior (mesmo dia, turno oposto, ou dia anterior)
- Heranca de dados de estratigrafia quando nao ha mudanca
- Auto-save de rascunho a cada 30 segundos

### Striplog com ROP automatico
- Tabela de operacoes metro a metro com profundidade, inicio, termino, tipo e observacao
- Calculo automatico de ROP (taxa de penetracao) por linha
- Indicacao colorida de desvio em relacao a media (verde: acima, vermelho: abaixo)
- Suporte a virada de meia-noite nos calculos de tempo

### BHA (Bottom Hole Assembly)
- Tabela de composicao da coluna de perfuracao
- Selector de itens comuns (com opcao "Outro" para item personalizado)
- Campos: item, qtd, ID (pol), OD (pol), comprimento (m), total (m)
- Calculo automatico do total por linha

### Fotos
- Upload multiplo de fotos (JPEG, PNG, WebP) para Supabase Storage
- Preview em miniatura antes do envio
- Remocao de fotas individuais
- Fotos enviadas apenas na submissao final (nao no rascunho)

### Fluxo de Aprovacao
- **Rascunho**: salvo localmente, editavel pelo autor
- **Em Revisao**: submetido, visivel para supervisores/administradores
- **Aprovado**: bloqueado para edicao, disponivel para exportacao PDF
- Reabertura: supervisor pode solicitar reabertura de RDO aprovado
- Colaboradores veem apenas leitura de RDOs aprovados ou em revisao

### Exportacao PDF
- Geracao cliente-side via jsPDF no painel admin
- Cabecalho com logo, dados do projeto, data e autor
- Corpo com todas as secoes do RDO (HSE, operacoes, striplog, brocas, BHA, fluido, equipe, insumos, fotos)
- Aprovacoes no rodape com data/hora
- Numeracao de paginas

### Painel Admin (`admin.html`)
- Abas: **Projetos**, **RDOs**, **Usuarios**
- Filtros de RDOs por status (rascunho/em revisao/aprovado), data e projeto
- Visualizacao detalhada de RDO com opcoes de aprovar, reabrir, exportar PDF ou excluir (soft-delete)
- Gestao de projetos (criar/editar/excluir)
- Listagem de usuarios cadastrados

---

## Banco de Dados (Supabase)

### Tabelas

| Tabela | Descricao |
|--------|-----------|
| `profiles` | Extensao de `auth.users` com nome, role e telefone |
| `projetos` | Projetos de perfuracao (cliente, localidade, sonda, data, turno) |
| `rdos` | Relatorios diarios com dados estruturados em JSONB |

### Colunas JSONB em `rdos`

| Coluna | Conteudo |
|--------|----------|
| `operacoes` | `[{ inicio, termino, tipo, descritivo }]` |
| `equipe` | `[{ funcao, nome }]` |
| `striplog` | `[{ profundidade, inicio, termino, obs, mode }]` |
| `brocas` | `{ atual: {...}, anterior: {...} }` |
| `coluna` | `[{ item, qty, id_pol, od_pol, length_m, total_m }]` |
| `fluido` | `{ densidade, viscosidade, filtrado, ph, ... }` |
| `quimicos` | `[{ produto, quantidade }]` |
| `combustivel` | `{ consumos: [...], estoque_s10, estoque_s500 }` |
| `parametros_anomalias` | `[{ parametro, descricao }]` |
| `estratigrafia_mudancas` | `[{ profundidade, descricao }]` |
| `outros_materiais` | `[{ item, qtd }]` |
| `insumos` | `[{ item, qtd }]` |
| `fotos` | `[url1, url2, ...]` |

### RLS (Row-Level Security)

- `profiles`: leitura liberada para authenticated; cada usuario edita o proprio perfil
- `projetos` e `rdos`: sem RLS no momento (desenvolvimento). Configurar antes de producao.

---

## Observacoes

- A **publishable key** e segura para uso no frontend. A **secret key** (usada em `.env.local`) nunca deve aparecer no codigo do cliente.
- O bucket `fotos` e publico: qualquer um com a URL pode acessar as imagens. Em producao, considere restringir o acesso.
- Soft-delete: RDOs excluidos recebem `deleted = true` em vez de serem removidos do banco.
- O app funciona offline para preenchimento, mas requer conexao para salvar/enviar (os dados ficam no form ate o envio).
