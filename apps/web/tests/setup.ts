import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react's automatic afterEach cleanup only self-registers
// when it detects global test hooks (vitest's own `globals: true`, not used
// in this repo — apps/api's tests import `vitest`'s hooks explicitly too,
// see apps/api/tests/setup.ts). Without this, every render() across tests
// in the same file piles up in the jsdom document instead of unmounting,
// so a later test's screen.getByRole can match more than one element.
afterEach(() => {
  cleanup();
});
