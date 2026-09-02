import { render, screen } from '@testing-library/react';
import App from './App';

const fs = require('fs');
const path = require('path');

test('renders the dashboard header', () => {
  render(<App />);
  expect(screen.getByText('OA Intelligence')).toBeInTheDocument();
});

// Regression guard: client code ships to the browser, so anything secret that
// appears here is public. These checks fail the build if a credential or a
// direct third-party API call is reintroduced into src/.
describe('no credentials are hardcoded in client code', () => {
  const srcDir = __dirname;
  const clientFiles = fs
    .readdirSync(srcDir)
    .filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.js$/.test(f));

  const read = (file) => fs.readFileSync(path.join(srcDir, file), 'utf8');

  test('there are client files to check', () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  test.each(clientFiles)('%s has no Discord webhook URL', (file) => {
    expect(read(file)).not.toMatch(/discord\.com\/api\/webhooks\//);
  });

  test.each(clientFiles)('%s does not call the Keepa API directly', (file) => {
    expect(read(file)).not.toMatch(/api\.keepa\.com/);
  });

  test.each(clientFiles)('%s has no long key-like string literal', (file) => {
    const matches = read(file).match(/["'`][A-Za-z0-9_-]{32,}["'`]/g) || [];
    expect(matches).toEqual([]);
  });
});
