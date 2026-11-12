import { expect, test } from "bun:test";
import { autosaveKey, readAutosave, writeAutosave } from "./autosave";
import { availableDestinations, chooseDestination, chooseRoute, endTurn, finishRivals, newRun, rivalAct, type Run } from "./game";

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
}

function resolveTurn(run: Run) {
  for (const rival of run.rivals) rivalAct(run, rival.id);
  finishRivals(run);
}

test("resuming mid-turn preserves the combat result and future draws", () => {
  const run = newRun(42);
  chooseRoute(run, 0);
  chooseDestination(run, availableDestinations(run)[0]);
  run.money = -20;
  run.guard = 5;
  expect(endTurn(run)).toBe(true);
  expect(rivalAct(run, run.rivals[0].id)).not.toBeNull();
  const storage = memoryStorage();
  writeAutosave({ run, pendingEndTurn: false, message: "Turno dos rivais." }, () => storage);

  const restored = readAutosave(() => storage)!.run;
  expect(restored.rivals[0].step).toBe(run.turn);
  expect(rivalAct(restored, restored.rivals[0].id)).toBeNull();
  resolveTurn(restored);
  resolveTurn(run);
  expect(restored).toEqual(run);
});

test("invalid, incompatible and unavailable storage leave the game playable", () => {
  const storage = memoryStorage();
  for (const raw of ["{", '{"version":0}', '{"version":1,"run":{"phase":"player"}}']) {
    storage.setItem(autosaveKey, raw);
    expect(readAutosave(() => storage)).toBeUndefined();
  }
  const unavailable = () => { throw new Error("Access denied"); };
  expect(readAutosave(unavailable)).toBeUndefined();
  expect(() => writeAutosave({ run: newRun(42), message: "", pendingEndTurn: false }, unavailable)).not.toThrow();
});
