# Modelos de e-mail do Supabase

Colar em **Supabase → Authentication → Emails → Templates**. Em cada modelo, troque o assunto e cole o HTML inteiro do arquivo.

| Modelo no Supabase | Assunto | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu cadastro no Umbra Torneios | confirmar-cadastro.html |
| Reset password | Sua nova senha do Umbra Torneios | nova-senha.html |
| Change email address | Confirme seu novo e-mail no Umbra Torneios | trocar-email.html |

As variáveis entre chaves duplas (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`) são preenchidas pelo Supabase. Não traduza nem apague.
