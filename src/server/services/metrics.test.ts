import { describe, expect, it } from "vitest";
import {
  isIgnoredNetIface,
  parseDefaultIface,
  parseNetDev,
} from "@/server/services/metrics";

const NET_DEV = `
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000       10    0    0    0     0          0         0     1000    10    0    0    0     0       0          0
  ens3: 5000000   100    0    0    0     0          0         0  2000000   80    0    0    0     0       0          0
docker0: 99999999  200    0    0    0     0          0         0 99999999  200    0    0    0     0       0          0
vethabc: 111       1    0    0    0     0          0         0      222    1    0    0    0     0       0          0
 br-xyz: 333       1    0    0    0     0          0         0      444    1    0    0    0     0       0          0
`;

const ROUTE = `Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\tMTU\tWindow\tIRTT
ens3\t00000000\t0100000A\t0003\t0\t0\t0\t00000000\t0\t0\t0
docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0
`;

describe("isIgnoredNetIface", () => {
  it("отсекает lo/docker/veth/br/wg", () => {
    expect(isIgnoredNetIface("lo")).toBe(true);
    expect(isIgnoredNetIface("docker0")).toBe(true);
    expect(isIgnoredNetIface("veth12ab")).toBe(true);
    expect(isIgnoredNetIface("br-9195")).toBe(true);
    expect(isIgnoredNetIface("awg0")).toBe(true);
    expect(isIgnoredNetIface("wg0")).toBe(true);
    expect(isIgnoredNetIface("ens3")).toBe(false);
    expect(isIgnoredNetIface("eth0")).toBe(false);
  });
});

describe("parseDefaultIface", () => {
  it("берёт iface с Destination 00000000", () => {
    expect(parseDefaultIface(ROUTE)).toBe("ens3");
  });
});

describe("parseNetDev", () => {
  it("предпочитает iface дефолтного маршрута", () => {
    const n = parseNetDev(NET_DEV, ROUTE);
    expect(n?.iface).toBe("ens3");
    expect(n?.rx).toBe(BigInt(5_000_000));
    expect(n?.tx).toBe(BigInt(2_000_000));
  });

  it("без route берёт iface с наибольшим трафиком (не docker)", () => {
    const n = parseNetDev(NET_DEV, null);
    expect(n?.iface).toBe("ens3");
  });

  it("пустой net/dev → null", () => {
    expect(parseNetDev("", null)).toBeNull();
  });
});
