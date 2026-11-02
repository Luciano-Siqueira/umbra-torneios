import { BANNER_IMAGE } from "../banner-image";

// Banner com arte fornecida pelo usuário
export function BannerArte() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url(${BANNER_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay escurecido para o texto ficar legível */}
      <div className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, rgba(10,9,22,0.55) 0%, rgba(10,9,22,0.15) 50%, rgba(10,9,22,0.55) 100%)",
        }}
      />
    </div>
  );
}
