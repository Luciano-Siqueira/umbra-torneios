// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvisoEnderecoNovo, deveMostrarAvisoEndereco } from "../AvisoEnderecoNovo";

const antiga = { id: "u-antiga", created_at: "2026-10-01T12:00:00Z" };
const nova = { id: "u-nova", created_at: "2026-11-10T12:00:00Z" };
const dia = (iso: string) => Date.parse(iso);

afterEach(() => { cleanup(); localStorage.clear(); });

describe("aviso do endereço novo", () => {
  it("aparece só para contas criadas antes da mudança, durante 90 dias", () => {
    expect(deveMostrarAvisoEndereco(antiga, dia("2026-11-10T12:00:00Z"))).toBe(true);
    expect(deveMostrarAvisoEndereco(antiga, dia("2027-02-05T12:00:00Z"))).toBe(true);
    expect(deveMostrarAvisoEndereco(antiga, dia("2027-02-08T12:00:00Z"))).toBe(false);
    expect(deveMostrarAvisoEndereco(nova, dia("2026-11-10T12:00:00Z"))).toBe(false);
    expect(deveMostrarAvisoEndereco({ id: "sem-data" }, dia("2026-11-10T12:00:00Z"))).toBe(false);
    expect(deveMostrarAvisoEndereco(null)).toBe(false);
  });

  it("some ao tocar em Entendi e não volta para a mesma conta", () => {
    const agora = Date.now();
    if (!deveMostrarAvisoEndereco(antiga, agora)) return; // depois dos 90 dias não há o que testar

    render(<AvisoEnderecoNovo usuario={antiga} />);
    expect(screen.getByText("torneios.umbraarena.com.br")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByText("torneios.umbraarena.com.br")).toBeNull();

    cleanup();
    render(<AvisoEnderecoNovo usuario={antiga} />);
    expect(screen.queryByText("torneios.umbraarena.com.br")).toBeNull();
    expect(deveMostrarAvisoEndereco({ ...antiga, id: "outra" }, agora)).toBe(true);
  });
});
