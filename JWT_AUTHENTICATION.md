# JWT authentication

Configure `DATABASE_URL` (or `POSTGRES_URL`) and a long, random `JWT_SECRET` locally and in Vercel. `JWT_EXPIRES_IN` defaults to `1h`, and `BCRYPT_SALT_ROUNDS` defaults to `12`.

After changing Vercel environment variables, redeploy the project.

## Register

`POST /api/users` remains public. Send a plain `password` over HTTPS; the API hashes it before storage and never returns the hash.

```json
{
  "full_name": "Alex Tan",
  "email": "alex@example.com",
  "password": "a-strong-password",
  "membership_tier": "standard"
}
```

## Login

Send credentials to `POST /api/login`:

```json
{
  "email": "alex@example.com",
  "password": "a-strong-password"
}
```

The response contains `token`, `expires_in`, and a safe `user` object.

## Call protected APIs

All other routes require this header:

```text
Authorization: Bearer <token>
```

A missing or malformed header returns `401`. An invalid or expired JWT returns `403`.
