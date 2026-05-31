import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clickFirstTemplateOpenButton,
  clickTabByLabel,
} from '../apps/web/src/components/OnboardingGate.jsx';

function createButton(label) {
  return {
    textContent: label,
    clicked: false,
    click() {
      this.clicked = true;
    },
  };
}

test('clickTabByLabel clicks matching tab button', () => {
  const previousDocument = globalThis.document;
  const suite = createButton('Suite');
  const templates = createButton('Templates');
  globalThis.document = {
    querySelectorAll(selector) {
      assert.equal(selector, '.tabs button');
      return [suite, templates];
    },
  };

  try {
    assert.equal(clickTabByLabel('Templates'), true);
    assert.equal(templates.clicked, true);
    assert.equal(suite.clicked, false);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('clickTabByLabel returns false when no tab matches', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll() {
      return [createButton('Suite')];
    },
  };

  try {
    assert.equal(clickTabByLabel('Missing'), false);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('clickFirstTemplateOpenButton clicks available open workspace button', () => {
  const previousDocument = globalThis.document;
  const openButton = createButton('Open in PhiWrite-lite');
  globalThis.document = {
    querySelector(selector) {
      assert.equal(selector, '.open-workspace-button');
      return openButton;
    },
  };

  try {
    assert.equal(clickFirstTemplateOpenButton(), true);
    assert.equal(openButton.clicked, true);
  } finally {
    globalThis.document = previousDocument;
  }
});
