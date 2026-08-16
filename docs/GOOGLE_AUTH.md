# Login com Google

## 1. Criar credenciais

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie/selecione um projeto
3. **APIs & Services → OAuth consent screen** (External, app em teste)
4. Adicione seu e-mail em **Test users**
5. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

## 2. Configurar o app

No arquivo `.env.local`:

```bash
AUTH_SECRET=...          # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=....apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-...
```

## 3. Rodar

```bash
npm run dev
```

Abra http://localhost:3000 — você será redirecionado para `/login`.

## Comportamento

- Com `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`: login Google obrigatório na home
- Sem essas variáveis: tela `/login` mostra instruções + modo local
- Após o login, nome/foto/email do Google sincronizam com o membro “você” da equipe
