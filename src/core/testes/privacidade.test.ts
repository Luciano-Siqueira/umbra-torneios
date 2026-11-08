// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { guardarAceiteLocal, precisaAceitarPrivacidade, VERSAO_PRIVACIDADE } from "../privacidade";

afterEach(() => localStorage.clear());

describe("aceite da política de privacidade", () => {
  it("pede o aceite de quem nunca aceitou ou aceitou uma versão antiga", () => {
    expect(precisaAceitarPrivacidade({ id: "a" })).toBe(true);
    expect(precisaAceitarPrivacidade({ id: "a", user_metadata: { privacidade_versao: "2020-01-01" } })).toBe(true);
  });

  it("não pede de quem já aceitou esta versão", () => {
    expect(precisaAceitarPrivacidade({ id: "a", user_metadata: { privacidade_versao: VERSAO_PRIVACIDADE } })).toBe(false);
  });

  it("aceite feito sem internet vale neste aparelho, só para a mesma conta", () => {
    guardarAceiteLocal("a");
    expect(precisaAceitarPrivacidade({ id: "a" })).toBe(false);
    expect(precisaAceitarPrivacidade({ id: "b" })).toBe(true);
  });

  it("sem conta, não há o que pedir", () => {
    expect(precisaAceitarPrivacidade(null)).toBe(false);
  });
});
