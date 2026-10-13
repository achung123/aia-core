import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  cleanup();
});

function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>;
}

describe('RTL setup smoke test', () => {
  it('renders a component and jest-dom matcher works', () => {
    render(<Greeting name="World" />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('toHaveTextContent matcher works', () => {
    render(<Greeting name="RTL" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, RTL!');
  });

  it('userEvent works', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Count: 0');
    await user.click(button);
    expect(button).toHaveTextContent('Count: 1');
  });
});
