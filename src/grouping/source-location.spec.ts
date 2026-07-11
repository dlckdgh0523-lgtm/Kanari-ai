import {
  buildBlobLink,
  parseGitHubRepo,
  parseTopAppFrame,
} from './source-location';

describe('parseTopAppFrame', () => {
  it('우리 코드 첫 프레임의 파일과 줄을 뽑는다', () => {
    const stack = [
      'BootError: fail',
      '    at bootstrap (/app/src/main.ts:15:9)',
      '    at Object.<anonymous> (/app/src/main.ts:38:1)',
    ].join('\n');
    expect(parseTopAppFrame(stack)).toEqual({ file: 'src/main.ts', line: 15 });
  });

  it('node_modules 프레임은 건너뛴다', () => {
    const stack = [
      'Error: x',
      '    at query (/app/node_modules/pg/lib/client.js:100:5)',
      '    at PayService.charge (/app/src/pay/pay.service.ts:12:9)',
    ].join('\n');
    expect(parseTopAppFrame(stack)).toEqual({
      file: 'src/pay/pay.service.ts',
      line: 12,
    });
  });

  it('스택이 없으면 null', () => {
    expect(parseTopAppFrame(undefined)).toBeNull();
  });

  it('우리 코드 프레임이 없으면 null', () => {
    const stack = 'Error: x\n    at query (/app/node_modules/pg/lib/client.js:100:5)';
    expect(parseTopAppFrame(stack)).toBeNull();
  });
});

describe('parseGitHubRepo', () => {
  it('https URL을 owner/repo로 분해한다', () => {
    expect(parseGitHubRepo('https://github.com/dlckdgh0523-lgtm/Kanari-ai')).toEqual({
      owner: 'dlckdgh0523-lgtm',
      repo: 'Kanari-ai',
    });
  });

  it('.git 접미사도 처리한다', () => {
    expect(parseGitHubRepo('https://github.com/a/b.git')).toEqual({
      owner: 'a',
      repo: 'b',
    });
  });

  it('GitHub이 아니면 null', () => {
    expect(parseGitHubRepo('https://gitlab.com/a/b')).toBeNull();
    expect(parseGitHubRepo(null)).toBeNull();
  });
});

describe('buildBlobLink', () => {
  it('정확한 줄로 가는 딥링크를 만든다', () => {
    const link = buildBlobLink(
      'https://github.com/a/b',
      { file: 'src/main.ts', line: 15 },
      'abc123',
    );
    expect(link).toBe('https://github.com/a/b/blob/abc123/src/main.ts#L15');
  });

  it('ref가 없으면 HEAD로 연결한다', () => {
    const link = buildBlobLink('https://github.com/a/b', { file: 'x.ts', line: 1 }, null);
    expect(link).toBe('https://github.com/a/b/blob/HEAD/x.ts#L1');
  });
});
