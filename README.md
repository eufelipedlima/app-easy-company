# Easy Company — Sistema Interno

Sistema de gestão interna da Easy Company: clientes, contratos, financeiro, projetos e demandas.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (banco de dados + auth)
- Deploy: Vercel

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local # preencha com suas chaves do Supabase
npm run dev
```

## Banco de dados

As migrations SQL ficam em `supabase/migrations`. Rode-as no SQL Editor do
Supabase (Dashboard → SQL Editor → colar o conteúdo do arquivo → Run).

