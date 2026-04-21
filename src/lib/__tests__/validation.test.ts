import { describe, expect, it } from "vitest";
import { normalizeAddress } from "../validation";

describe("normalizeAddress", () => {
  it("normalizes evm address to checksum", () => {
    const value = normalizeAddress("eth", "0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(value).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  it("normalizes bsc address to checksum", () => {
    const value = normalizeAddress("bsc", "0x55d398326f99059ff775485246999027b3197955");
    expect(value).toBe("0x55d398326f99059fF775485246999027B3197955");
  });

  it("accepts valid btc address", () => {
    const value = normalizeAddress("btc", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    expect(value).toBe("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
  });

  it("throws on invalid btc address", () => {
    expect(() => normalizeAddress("btc", "invalid")).toThrowError("Invalid Bitcoin address");
  });

  it("accepts valid trc20 address", () => {
    const value = normalizeAddress("trc20", "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj");
    expect(value).toBe("TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj");
  });

  it("throws on invalid trc20 address", () => {
    expect(() => normalizeAddress("trc20", "invalid")).toThrowError("Invalid TRON address");
  });
});
