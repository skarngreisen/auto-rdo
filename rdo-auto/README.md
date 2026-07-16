# RDO Auto — PWA para Preenchimento de Relatorio Diario de Obras

Aplicativo web progressivo (PWA) para supervisores de campo preencherem o RDO diretamente
no celular, eliminando papel e digitacao manual.

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
3. Isso criara as tabelas `projetos` e `rdos`, inserira dados de teste e desabilitara RLS.

### 2. Storage (Bucket de Fotos)

O bucket **nao pode ser criado via SQL**. Faca manualmente:

1. No Dashboard do Supabase, va em **Storage**.
2. Clique em **New Bucket**.
3. Nome: `fotos`
4. Marque **Public bucket** (para que as URLs das fotos sejam acessiveis).
5. File size limit: `5 MB`.
6. Allowed MIME types: `image/jpeg, image/png, image/webp`.

### 3. Credenciais

O arquivo `index.html` ja vem com as credenciais do projeto:

```js
const SUPABASE_URL = "https://fecskilrtsaeavoznwgi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VjwnlFeGz7zJkZx_KPxukA_GCTRxcgi";
```

Se precisar usar outro projeto, substitua esses valores no topo do `<script>`.

---

## Como Testar Localmente

1. Abra `index.html` diretamente no navegador (nao precisa de servidor).
2. Selecione um projeto no dropdown (ex.: "Artesano — Ribeirao Preto").
3. Preencha o formulario do RDO.
4. Clique em **Salvar RDO**.
5. Verifique os dados no Supabase: **Table Editor → rdos**.

---

## Estrutura do Projeto

```
RDO auto/
├── index.html          # Aplicativo completo (HTML + CSS + JS)
├── seed.sql            # Criacao das tabelas + dados de teste
├── README.md           # Este arquivo
├── docs/
│   ├── estrutura_referencia.md   # Schema extraido da planilha original
│   └── lacunas-bdo.md            # Analise de lacunas do BDO atual
└── references/
    └── RDOs Artesano.xlsx        # Planilha original de referencia
```

---

## Funcionalidades

- Selecao/criacao de projetos
- Formulario dinamico com secoes condicionais (Sim/Nao)
- Preenchimento offline-first (dados persistem no localStorage?)
- Upload de fotos para Supabase Storage
- Envio de RDO com dados estruturados em JSONB
- Design responsivo mobile-first

---

## Observacoes

- **RLS desabilitada** para teste. Em producao, configure politicas de acesso.
- A **publishable key** e segura para uso no frontend. A **secret key** nunca deve
  aparecer no codigo do cliente.
- O bucket `fotos` e publico: qualquer um com a URL pode acessar as imagens.
  Em producao, considere restringir o acesso.
