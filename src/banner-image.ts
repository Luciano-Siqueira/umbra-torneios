import banner from "./assets/banner.webp";

export const BANNER_IMAGE = banner;

// Fundo das telas de trabalho: o banner aparece no topo e escurece para não atrapalhar a leitura
export const FUNDO_DE_TELA = {
  backgroundImage: `linear-gradient(to bottom,
    rgba(10,10,10,0.65) 0%,
    rgba(10,10,10,0.75) 20%,
    rgba(10,10,10,0.85) 45%,
    rgba(10,10,10,0.94) 100%), url(${BANNER_IMAGE})`,
  backgroundSize: "cover",
  backgroundPosition: "center top",
  backgroundAttachment: "fixed",
} as const;
