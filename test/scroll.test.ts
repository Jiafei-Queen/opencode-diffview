import { expect, test } from "bun:test"
import { scrollLines, scrollWheel, wheelAcceleration } from "../src/ui/scroll"

test("clamps the keyboard scroll step to whole lines", () => {
  expect(scrollLines(undefined)).toBe(1)
  expect(scrollLines(Number.NaN)).toBe(1)
  expect(scrollLines(0)).toBe(1)
  expect(scrollLines(4.8)).toBe(4)
  expect(scrollLines(50)).toBe(20)
})

test("clamps the mouse wheel multiplier", () => {
  expect(scrollWheel(undefined)).toBe(1)
  expect(scrollWheel(0)).toBe(1)
  expect(scrollWheel(0.1)).toBe(0.25)
  expect(scrollWheel(2.5)).toBe(2.5)
  expect(scrollWheel(9)).toBe(5)
})

test("wheel acceleration reports the current multiplier", () => {
  let speed = 2
  const acceleration = wheelAcceleration(() => speed)
  expect(acceleration.tick()).toBe(2)
  speed = 0.5
  expect(acceleration.tick()).toBe(0.5)
  expect(() => acceleration.reset()).not.toThrow()
})
