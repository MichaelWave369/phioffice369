import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clickFirstTemplateOpenButton,
  clickTabByLabel,
} from '../apps/web/src/lib/onboardingDom.js';

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
  const suite = createButton('Suite');
  const templates = createButton('Templates');
  const doc = {
    querySelectorAll(selector) {
      assert.equal(selector, '.tabs button');
      return [suite, templates];
    },
  };

  assert.equal(clickTabByLabel('Templates', doc), true);
  assert.equal(templates.clicked, true);
  assert.equal(suite.clicked, false);
});

test('clickTabByLabel returns false when no tab matches', () => {
  const doc = {
    querySelectorAll() {
      return [createButton('Suite')];
    },
  };

  assert.equal(clickTabByLabel('Missing', doc), false);
});

test('clickFirstTemplateOpenButton clicks available open workspace button', () => {
  const openButton = createButton('Open in PhiWrite-lite');
  const doc = {
    querySelector(selector) {
      assert.equal(selector, '.open-workspace-button');
      return openButton;
    },
  };

  assert.equal(clickFirstTemplateOpenButton(doc), true);
  assert.equal(openButton.clicked, true);
});
