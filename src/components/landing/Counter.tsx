import * as CountUpModule from "react-countup";
import type { ComponentType } from "react";

type CounterProps = {
  end: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

const CountUp = ((CountUpModule as unknown as { default?: unknown }).default ??
  CountUpModule) as ComponentType<Record<string, unknown>>;

export function Counter({ end, decimals = 0, prefix = "", suffix = "" }: CounterProps) {
  return (
    <CountUp
      start={0}
      end={end}
      duration={2.4}
      decimals={decimals}
      decimal=","
      separator="."
      prefix={prefix}
      suffix={suffix}
      enableScrollSpy
      scrollSpyOnce={false}
    />
  );
}
