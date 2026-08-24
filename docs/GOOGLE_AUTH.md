# Login com Google

## Erro “404. That’s an error” no Google

Isso **não** é bug do Jangada. O Google rejeita o `redirect_uri` porque ele não está
cadastrado no OAuth Client.

1. Abra [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Edite o OAuth Client (tipo **Web application**, não Desktop)
3. Em **Authorized JavaScript origins** adicione:
   - `http://localhost:3000`
4. Em **Authorized redirect URIs** adicione **exatamente**:
   - `http://localhost:3000/api/auth/callback/google`
5. Salve e aguarde 1–2 minutos
6. Tente de novo em http://localhost:3000/login

## Credenciais no Jangada

No `.env.local`:

```bash
AUTH_SECRET=...
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=....apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-...
```

Reinicie: `npm run dev`.

## Nota sobre o qclawmonitor

O arquivo `google_client_secret.json` do qclawmonitor é tipo **Desktop (`installed`)**
com redirect `http://localhost` — **não serve** para o login web do Next.js.
Use um client **Web application** (ou adicione a URI acima no client Web existente).
