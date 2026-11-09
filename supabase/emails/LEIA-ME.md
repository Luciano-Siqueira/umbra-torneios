# Modelos de e-mail do Supabase

Colar em **Supabase → Authentication → Emails → Templates**. Em cada modelo, troque o assunto e cole o HTML inteiro do arquivo.

| Modelo no Supabase | Assunto | Arquivo | O app usa? |
|---|---|---|---|
| Confirm sign up | Confirme seu cadastro no Umbra Torneios | confirmar-cadastro.html | Sim, no cadastro |
| Invite user | Seu convite para o Umbra Torneios | convite.html | Só se convidar pelo painel do Supabase |
| Magic link or OTP | Seu link de acesso ao Umbra Torneios | link-de-acesso.html | Não hoje (login é com senha) |
| Change email address | Confirme seu novo e-mail no Umbra Torneios | trocar-email.html | Sim, ao trocar o e-mail |
| Reset password | Sua nova senha do Umbra Torneios | nova-senha.html | Sim, no reset de senha |
| Reauthentication | Seu código de confirmação do Umbra Torneios | reautenticacao.html | Só se ativar a confirmação para trocar senha |

As variáveis entre chaves duplas (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}`) são preenchidas pelo Supabase. Não traduza nem apague.
