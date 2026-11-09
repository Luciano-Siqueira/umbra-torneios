// Avisos (notificações) do Umbra Torneios, carregado pelo service worker do PWA (workbox importScripts).
// Mostra o aviso mesmo com o app fechado e, ao tocar, abre ou traz para a frente a janela do app.

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { body: evento.data ? evento.data.text() : "" };
  }
  const titulo = dados.title || "Umbra Torneios";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/icon-192.png",
      // Ícone pequeno da barra de status (Android): só o contorno conta, então é branco sobre transparente
      badge: "/badge-96.png",
      tag: dados.tag, // o mesmo aviso não se repete na bandeja
      renotify: true,
      data: { url: dados.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (aberta) {
        aberta.focus();
        return aberta.navigate ? aberta.navigate(destino) : undefined;
      }
      return self.clients.openWindow(destino);
    })
  );
});
