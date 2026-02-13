# Backend

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm start
```

## Sincronizar schema no banco

```bash
npm run db:sync
```

## Variáveis obrigatórias

- `DATABASE_URL` (PostgreSQL)
- `GEMINI_API_KEY`
- `JWT_SECRET` (mínimo de 32 caracteres)
- `APP_URL`

## Variáveis opcionais (recomendadas)

- `CORS_ORIGINS`
- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `META_PIXEL_ID`
- `META_ACCESS_TOKEN`
- `ADMIN_EMAILS` (lista de e-mails admins separados por vírgula ou espaço)
