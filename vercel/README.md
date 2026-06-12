# Plataforma de Revisão — Eixo Operações (FACC/UFRJ)

## Publicar no Vercel com sincronização em tempo real
1. Crie um repositório no GitHub e suba esta pasta (index.html, api/state.js, package.json).
2. No Vercel: Add New > Project > importe o repositório > Deploy.
3. No painel do projeto: Storage > Create Database > KV (Upstash) > Connect.
   As variáveis KV_REST_API_URL e KV_REST_API_TOKEN são criadas automaticamente.
4. Redeploy. O cabeçalho mostrará "sincronizado": qualquer decisão de um colega
   aparece para os demais em até 4 segundos (polling).

## Sem Vercel
Abrir o index.html diretamente também funciona; as decisões ficam salvas
apenas no navegador local (localStorage) e o cabeçalho mostra "sem sincronização".
