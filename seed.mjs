import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';

const apiBase = new URL(process.env.API_BASE_URL ?? 'http://localhost:8000/api/v1/');
if (!apiBase.pathname.endsWith('/')) {
  apiBase.pathname += '/';
}

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password) {
  throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in the environment before running the seed.');
}

const runId = process.env.SEED_RUN_ID ?? String(randomInt(10_000_000, 100_000_000));
if (!/^\d{8}$/.test(runId)) {
  throw new Error('SEED_RUN_ID must contain exactly eight digits.');
}
const progress = { books: 0, members: 0, loans: 0 };
let token;

async function api(path, { method = 'GET', body, testTime } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (testTime) {
    headers['X-Test-Time'] = testTime;
  }

  const response = await fetch(new URL(path.replace(/^\//, ''), apiBase), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text !== '') {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code = typeof payload?.code === 'string' ? payload.code : 'NON_JSON_ERROR';
    const message = typeof payload?.message === 'string' ? payload.message : 'The API returned a non-JSON error.';
    throw new Error(`${method} ${path} failed with HTTP ${response.status} (${code}): ${message}`);
  }
  if (payload === null) {
    throw new Error(`${method} ${path} returned an empty or invalid JSON response.`);
  }

  return payload;
}

async function seed() {
  const session = await api('auth/login', {
    method: 'POST',
    body: { username, password },
  });
  assert.equal(session.token_type, 'Bearer', 'Login did not return a Bearer token.');
  assert.equal(session.role, 'admin', 'The configured account must have the admin role.');
  token = session.access_token;
  assert.ok(token, 'Login did not return an access token.');

  const categoryResponse = await api('categories');
  assert.ok(Array.isArray(categoryResponse.items) && categoryResponse.items.length >= 5, 'Expected the five seeded categories.');

  const bookSearch = await api(`books?q=${encodeURIComponent(runId)}&size=50`);
  const existingBooks = new Map(bookSearch.items.map((book) => [book.title, book]));
  const books = [];
  for (let index = 0; index < 40; index += 1) {
    const title = `Libro de demostración ${runId}-${String(index + 1).padStart(2, '0')}`;
    const book = existingBooks.get(title) ?? await api('books', {
      method: 'POST',
      body: {
        title,
        author: `Autor de demostración ${runId}`,
        isbn: `979${runId}${String(index + 1).padStart(2, '0')}`,
        category_id: categoryResponse.items[index % categoryResponse.items.length].id,
        total_copies: 2,
      },
    });
    assert.ok(book.id, 'Book creation did not return an id.');
    books.push(book);
    progress.books += 1;
  }

  const memberSearch = await api(`members?q=${encodeURIComponent(runId)}&size=50`);
  const existingMembers = new Map(memberSearch.items.map((member) => [member.full_name, member]));
  const members = [];
  for (let index = 0; index < 10; index += 1) {
    const number = String(index + 1).padStart(2, '0');
    const fullName = `Socio de demostración ${runId}-${number}`;
    const member = existingMembers.get(fullName) ?? await api('members', {
      method: 'POST',
      body: { full_name: fullName, document_number: `ML${runId}M${number}` },
    });
    assert.ok(member.id, 'Member creation did not return an id.');
    members.push(member);
    progress.members += 1;
  }

  async function findExistingLoan(memberId, bookId) {
    const response = await api(`loans?member_id=${encodeURIComponent(memberId)}&size=50`);
    for (const summary of response.items) {
      const detail = await api(`loans/${encodeURIComponent(summary.id)}`);
      if (detail.items.some((item) => item.book_id === bookId)) {
        return detail;
      }
    }
    return null;
  }

  const loans = [];
  for (let index = 0; index < 3; index += 1) {
    let loan = await findExistingLoan(members[index].id, books[index].id);
    if (loan === null) {
      loan = await api('loans', {
        method: 'POST',
        testTime: '2020-01-01T00:00:00Z',
        body: { member_id: members[index].id, items: [{ book_id: books[index].id }] },
      });
    }
    assert.equal(loan.loaned_at, '2020-01-01T00:00:00Z', 'The seeded overdue loan must use the configured historical time.');
    assert.equal(loan.items[0]?.due_at, '2020-01-15T00:00:00Z', 'The historical loan must have the documented 14-day due date.');
    loans.push(loan);
    progress.loans += 1;
  }

  for (let index = 0; index < 12; index += 1) {
    const member = members[3 + (index % 7)];
    const book = books[index + 3];
    const loan = await findExistingLoan(member.id, book.id) ?? await api('loans', {
      method: 'POST',
      body: { member_id: member.id, items: [{ book_id: book.id }] },
    });
    assert.equal(loan.status, 'open', 'A loan created at system time should be open.');
    loans.push(loan);
    progress.loans += 1;
  }

  const overdue = await api('loans/overdue');
  const createdOverdueIds = new Set(loans.slice(0, 3).map((loan) => loan.id));
  const createdOverdueLines = overdue.items.filter((item) => createdOverdueIds.has(item.loan_id));
  assert.equal(createdOverdueLines.length, 3, 'The overdue endpoint must return all three seeded overdue lines.');

  const report = await api('reports/most-borrowed?from=2020-01-01&to=2099-12-31');
  assert.ok(Array.isArray(report.rows) && report.rows.length > 0, 'The most-borrowed report should contain seeded loans.');

  return {
    run_id: runId,
    ready: { books: progress.books, members: progress.members, loans: progress.loans },
    seeded_overdue_lines: createdOverdueLines.length,
    overdue_lines_returned: overdue.items.length,
    report_rows: report.rows.length,
  };
}

try {
  const result = await seed();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Seed ${runId} stopped with ${progress.books}/40 books, ${progress.members}/10 members, and ${progress.loans}/15 loans ready.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
