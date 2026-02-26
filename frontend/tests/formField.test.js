import { describe, it, expect } from 'vitest';
import {
  FormField,
  createEmailField,
  createPasswordField,
  createTextField,
  createTelField,
  createUrlField
} from '../src/lib/formField.js';

describe('FormField', () => {
  it('trim et coupe à maxLength sur un champ texte', () => {
    const field = new FormField({ maxLength: 5 });
    field.value = '  abcdef  ';
    expect(field.value).toBe('abcde');
  });

  it('applique minLength sur une valeur non vide', () => {
    const field = new FormField({ minLength: 4 });
    field.value = 'abc';
    expect(field.getError()).toBe('Minimum 4 caractères');
  });

  it('applique la validation pattern', () => {
    const field = new FormField({
      pattern: /^[0-9]+$/,
      patternMessage: 'Doit être numérique'
    });
    field.value = 'ab';
    expect(field.getError()).toBe('Doit être numérique');
  });
});

describe('create*Field helpers', () => {
  it('createEmailField: requis et trim', () => {
    const field = createEmailField();
    field.value = '  user@example.com  ';
    expect(field.value).toBe('user@example.com');
    field.value = '';
    expect(field.getError()).toBe('Champ requis');
  });

  it('createPasswordField: ne trim pas et impose minLength', () => {
    const field = createPasswordField();
    field.value = ' 1234567 ';
    expect(field.value).toBe(' 1234567 ');
    expect(field.getError()).toBeNull();

    field.value = '123';
    expect(field.getError()).toMatch(/Minimum 8 caractères/);
  });

  it('createTextField / createTelField / createUrlField retournent des champs valides', () => {
    const text = createTextField({ maxLength: 3, required: true });
    text.value = ' abcd ';
    expect(text.value).toBe('abc');
    expect(text.getError()).toBeNull();

    const tel = createTelField({ maxLength: 4 });
    tel.value = ' 12345 ';
    expect(tel.value).toBe('1234');

    const url = createUrlField();
    url.value = ' https://example.com ';
    expect(url.value).toBe('https://example.com');
  });
});
