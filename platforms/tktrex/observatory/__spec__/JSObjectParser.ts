import JSObjectParser from '../src/JSObjectParser';

describe('The JSObjectParser function', () => {
  it('parses a simple object', () => {
    const source = '{ a: 1 }';
    const expected = { a: 1 };

    const actual = JSObjectParser(source);
    expect(actual).toEqual(expected);
  });
});
