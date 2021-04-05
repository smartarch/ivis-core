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

test('constant evaluation numbers', async () => {
    const result = await evaluate('1+2==4', 1);
    expect(result).toBe(false);
});

test('constant evaluation strings', async () => {
    const result = await evaluate('compareText("abc", "abc") == 0', 1);
    expect(result).toBe(true);
});
