jest.mock('../../lib/knex');
jest.mock('../../models/signal-sets');
jest.mock('../../lib/config');

const { evaluate } = require('../../lib/alerts-condition-parser');

test('constant evaluation bool #1', async () => {
    const result = await evaluate('true', 1);
    expect(result).toBe(true);
});

test('constant evaluation bool #2', async () => {
    const result = await evaluate('false', 1);
    expect(result).toBe(false);
});

test('constant evaluation numbers #1', async () => {
    const result = await evaluate('1+2==4+3', 1);
    expect(result).toBe(false);
});

test('constant evaluation numbers #2', async () => {
    const result = await evaluate('1+2==4-1', 1);
    expect(result).toBe(true);
});

test('constant evaluation strings', async () => {
    const result = await evaluate('equalText("abc", "abc")', 1);
    expect(result).toBe(true);
});

test('constant evaluation for error #1', async () => {
    const result = await evaluate('1+2*3/4', 1);
    expect(result).toBe('NotBoolError');
});

test('constant evaluation for error #2', async () => {
    const result = await evaluate('pseudofunc(123, 45) == 42', 1);
    expect(result).toMatch(/.* is not a function/);
});

test('constant evaluation for error #3', async () => {
    const result = await evaluate('a = 5', 1);
    expect(result).toBe('NotBoolError');
});

test('constant evaluation for error #4', async () => {
    const result = await evaluate('1 + 2 == 3 +', 1);
    expect(result).toBe('Unexpected end of expression (char 13)');
});

test('function declaration #1', async () => {
    const result = await evaluate('mojefun(x) = x * x;\nmojefun(5) == 25', 1);
    expect(result).toBe(true);
});

test('function declaration #2', async () => {
    const result = await evaluate('mojefun(x) = x * x; mojefun(5) == 26', 1);
    expect(result).toBe(false);
});

test('variable declaration #1', async () => {
    const result = await evaluate('mojevar = 1 + 2;\nmojevar == 5 - 2', 1);
    expect(result).toBe(true);
});

test('variable declaration #2', async () => {
    const result = await evaluate('mojevar = 1 + 2; 5 - 3 == mojevar', 1);
    expect(result).toBe(false);
});

test('function and variable declaration', async () => {
    const result = await evaluate('mojefunc(x) = x * x;\nfr(x, y) = x + y;\nmojevar = 6 + 4; vr = 5;\nmojefunc(mojevar) == fr(vr, 95)', 1);
    expect(result).toBe(true);
});

test('past function on regular signal set #1', async () => {
    const result = await evaluate('past("siga", 2) == 96', 1);
    expect(result).toBe(true);
});

test('past function on regular signal set #2', async () => {
    const result = await evaluate('past("siga", 3) == 96', 1);
    expect(result).toBe(false);
});

test('past function on regular signal set #3', async () => {
    const result = await evaluate('past("sigc", 100)', 1);
    expect(result).toBe(true);
});

test('past function on regular signal set #4', async () => {
    const result = await evaluate('past("id", past("siga", 5)) == "8"', 1);
    expect(result).toBe(true);
});

test('avg function on regular signal set #1', async () => {
    const result = await evaluate('avg("siga", 4) != 217.35', 1);
    expect(result).toBe(false);
});

test('avg function on regular signal set #2', async () => {
    const result = await evaluate('avg("siga", 100) == 148.984', 1);
    expect(result).toBe(true);
});

test('avg function on regular signal set #3', async () => {
    const result = await evaluate('avg("sigb", 6) == 148.984', 1);
    expect(result).toBe('Argument in avg function is not a number!');
});

test('var function on regular signal set', async () => {
    const result = await evaluate('var("siga", 4) == 79361.1675', 1);
    expect(result).toBe(true);
});

test('min function on regular signal set #1', async () => {
    const result = await evaluate('min("siga", 8) == -69', 1);
    expect(result).toBe(true);
});

test('min function on regular signal set #2', async () => {
    const result = await evaluate('equalText(min("sigb", 5), "ahoj")', 1);
    expect(result).toBe(true);
});

test('max function on regular signal set #1', async () => {
    const result = await evaluate('max("siga", 8) == 693', 1);
    expect(result).toBe(true);
});

test('max function on regular signal set #2', async () => {
    const result = await evaluate('equalText(max("sigb", 5), "se")', 1);
    expect(result).toBe(true);
});

test('qnt function on regular signal set #1', async () => {
    const result = await evaluate('qnt("siga", 5, 0.5) == 96', 1);
    expect(result).toBe(true);
});

test('qnt function on regular signal set #2', async () => {
    const result = await evaluate('qnt("siga", 5, 1) == 693', 1);
    expect(result).toBe(true);
});

test('qnt function on regular signal set #3', async () => {
    const result = await evaluate('qnt("siga", 5, 0) == -69', 1);
    expect(result).toBe(true);
});

test('qnt function on regular signal set #4', async () => {
    const result = await evaluate('equalText(qnt("sigb", 5, 0.5), "mas")', 1);
    expect(result).toBe(true);
});

test('latest values of regular signal set #1', async () => {
    const result = await evaluate('equalText($id, "9")', 1);
    expect(result).toBe(true);
});

test('latest values of regular signal set #2', async () => {
    const result = await evaluate('$siga == 123', 1);
    expect(result).toBe(true);
});

test('latest values of regular signal set #3', async () => {
    const result = await evaluate('equalText($sigb, "ahoj")', 1);
    expect(result).toBe(true);
});

test('latest values of regular signal set #4', async () => {
    const result = await evaluate('$sigc', 1);
    expect(result).toBe(false);
});

test('latest values of regular signal set #5', async () => {
    const result = await evaluate('$sigc == false', 1);
    expect(result).toBe(true);
});

test('latest values of sparse signal set #1', async () => {
    const result = await evaluate('$siga == 1', 2);
    expect(result).toBe(false);
});

test('latest values of sparse signal set #2', async () => {
    const result = await evaluate('$siga == null', 2);
    expect(result).toBe(true);
});

test('past function on sparse signal set', async () => {
    const result = await evaluate('past("siga", 4) == null', 2);
    expect(result).toBe(true);
});

test('avg function on sparse signal set', async () => {
    const result = await evaluate('avg("siga", 5) == 248.8', 2);
    expect(result).toBe(true);
});

test('var function on sparse signal set', async () => {
    const result = await evaluate('var("siga", 5) == 101858.48', 2);
    expect(result).toBe(true);
});

test('min function on sparse signal set #1', async () => {
    const result = await evaluate('min("siga", 4) == -42.6', 2);
    expect(result).toBe(true);
});

test('min function on sparse signal set #2', async () => {
    const result = await evaluate('equalText(min("sigb", 4), "")', 2);
    expect(result).toBe(true);
});

test('max function on sparse signal set #1', async () => {
    const result = await evaluate('max("siga", 2) == -42.6', 2);
    expect(result).toBe(true);
});

test('max function on sparse signal set #2', async () => {
    const result = await evaluate('equalText(max("sigb", 4), "se")', 2);
    expect(result).toBe(true);
});

test('min function null #1', async () => {
    const result = await evaluate('min("siga", 1) == null', 2);
    expect(result).toBe(true);
});

test('min function null #2', async () => {
    const result = await evaluate('min("sigb", 0) == null', 2);
    expect(result).toBe(true);
});

test('max function null #1', async () => {
    const result = await evaluate('max("siga", 1) == null', 2);
    expect(result).toBe(true);
});

test('max function null #2', async () => {
    const result = await evaluate('max("sigb", 0) == null', 2);
    expect(result).toBe(true);
});

test('qnt function on sparse signal set #1', async () => {
    const result = await evaluate('qnt("siga", 6, 0.5) == 1', 2);
    expect(result).toBe(true);
});

test('qnt function on sparse signal set #2', async () => {
    const result = await evaluate('equalText(qnt("sigb", 6, 0.5), "ahoj")', 2);
    expect(result).toBe(true);
});
