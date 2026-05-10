import assert from "node:assert/strict";
import test from "node:test";
import {
  isDescriptionExpandControl,
  isTranscriptOpenControl,
} from "../../extension/lib/player-response.js";

function elementLike({
  textContent = "",
  attributes = {},
}: {
  textContent?: string;
  attributes?: Record<string, string | null>;
}) {
  return {
    textContent,
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
  };
}

test("isTranscriptOpenControl matches visible Show transcript text without aria-label", () => {
  const control = elementLike({ textContent: "Show transcript" });
  assert.equal(isTranscriptOpenControl(control), true);
});

test("isTranscriptOpenControl matches transcript aria-label variants", () => {
  const control = elementLike({ attributes: { "aria-label": "Open transcript panel" } });
  assert.equal(isTranscriptOpenControl(control), true);
});

test("isDescriptionExpandControl matches visible more text without legacy expand id", () => {
  const control = elementLike({ textContent: "...more" });
  assert.equal(isDescriptionExpandControl(control), true);
});

test("isDescriptionExpandControl does not match YouTube's more actions menu", () => {
  const control = elementLike({ attributes: { "aria-label": "More actions" } });
  assert.equal(isDescriptionExpandControl(control), false);
});
