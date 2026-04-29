import React from 'react';
import { render } from '@testing-library/react';
import Header, { HeaderProps } from '../../../src/cli/tui/components/Header';

describe('Header Component', () => {
  const baseProps: HeaderProps = {
    stage: 'Initialization',
    completed: 3,
    total: 10,
    version: '1.0.0',
    projectRoot: '/home/user/project',
    projectVersion: '2.3.4',
  };

  it('renders project name, version, stage, and step counter', () => {
    const { getByText } = render(<Header {...baseProps} />);
    expect(getByText(/Initialization/i)).toBeInTheDocument();
    expect(getByText(/3\s*\/\s*10/i)).toBeInTheDocument();
    expect(getByText(/1\.0\.0/i)).toBeInTheDocument();
    expect(getByText(/2\.3\.4/i)).toBeInTheDocument();
    expect(getByText(/project/i)).toBeInTheDocument();
  });

  it('renders without optional version and projectVersion', () => {
    const { queryByText } = render(
      <Header
        stage="Build"
        completed={0}
        total={5}
        projectRoot="/tmp/test"
      />
    );
    expect(queryByText(/Build/i)).toBeInTheDocument();
    expect(queryByText(/0\s*\/\s*5/i)).toBeInTheDocument();
    expect(queryByText(/1\.0\.0/i)).not.toBeInTheDocument();
    expect(queryByText(/2\.3\.4/i)).not.toBeInTheDocument();
  });

  it('handles null projectVersion gracefully', () => {
    const { queryByText } = render(
      <Header
        stage="Deploy"
        completed={5}
        total={5}
        version="3.1.4"
        projectRoot="/deploy"
        projectVersion={null}
      />
    );
    expect(queryByText(/Deploy/i)).toBeInTheDocument();
    expect(queryByText(/5\s*\/\s*5/i)).toBeInTheDocument();
    expect(queryByText(/3\.1\.4/i)).toBeInTheDocument();
    expect(queryByText(/null/i)).not.toBeInTheDocument();
  });

  it('shows 0/0 when completed and total are zero', () => {
    const { getByText } = render(
      <Header stage="Idle" completed={0} total={0} />
    );
    expect(getByText(/0\s*\/\s*0/i)).toBeInTheDocument();
    expect(getByText(/Idle/i)).toBeInTheDocument();
  });

  it('handles negative and overflow step counts', () => {
    const { getByText } = render(
      <Header stage="Overflow" completed={-1} total={1000} />
    );
    expect(getByText(/-1\s*\/\s*1000/i)).toBeInTheDocument();
    expect(getByText(/Overflow/i)).toBeInTheDocument();
  });

  it('renders correctly with minimal required props', () => {
    const { getByText } = render(
      <Header stage="Minimal" completed={1} total={2} />
    );
    expect(getByText(/Minimal/i)).toBeInTheDocument();
    expect(getByText(/1\s*\/\s*2/i)).toBeInTheDocument();
  });
});
