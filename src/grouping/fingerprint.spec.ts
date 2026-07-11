import { computeFingerprint } from './fingerprint';

// fingerprint는 이 프로젝트의 심장이다. "같은 원인끼리 묶는다"는 약속이
// 깨지면 알람이 스팸이 되거나 서로 다른 버그가 한 그룹으로 뭉친다.
// 그래서 이 순수 함수의 규칙을 테스트로 못박는다.
describe('computeFingerprint', () => {
  const stackA = [
    'TypeError: Cannot read properties of undefined',
    '    at UserService.find (/app/src/users/users.service.ts:42:15)',
    '    at UsersController.get (/app/src/users/users.controller.ts:18:20)',
  ].join('\n');

  it('같은 스택은 같은 지문을 낸다', () => {
    const a = computeFingerprint('TypeError', 'msg', stackA);
    const b = computeFingerprint('TypeError', 'msg', stackA);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('줄 번호만 다르면 같은 지문이다 (배포로 줄이 밀려도 같은 버그)', () => {
    const shifted = stackA.replace(':42:15', ':47:15').replace(':18:20', ':23:20');
    const a = computeFingerprint('TypeError', 'msg', stackA);
    const b = computeFingerprint('TypeError', 'msg', shifted);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('다른 파일에서 나면 다른 지문이다 (다른 버그)', () => {
    const other = stackA.replace('users.service.ts', 'orders.service.ts');
    const a = computeFingerprint('TypeError', 'msg', stackA);
    const b = computeFingerprint('TypeError', 'msg', other);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('node_modules 프레임은 무시하고 우리 코드로 묶는다', () => {
    const withLib = [
      'TypeError: x',
      '    at Object.query (/app/node_modules/pg/lib/client.js:100:5)',
      '    at UserService.find (/app/src/users/users.service.ts:42:15)',
    ].join('\n');
    const withoutLib = [
      'TypeError: x',
      '    at UserService.find (/app/src/users/users.service.ts:42:15)',
    ].join('\n');
    const a = computeFingerprint('TypeError', 'x', withLib);
    const b = computeFingerprint('TypeError', 'x', withoutLib);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('topFrame은 우리 코드 최상단 위치를 담는다', () => {
    const { topFrame } = computeFingerprint('TypeError', 'msg', stackA);
    expect(topFrame).toContain('users.service.ts');
  });

  it('스택이 없으면 메시지의 가변 값(숫자)을 정규화해 묶는다', () => {
    const a = computeFingerprint('Error', 'order 10293 payment failed');
    const b = computeFingerprint('Error', 'order 55821 payment failed');
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('스택이 없고 메시지가 다르면 다른 지문이다', () => {
    const a = computeFingerprint('Error', 'payment failed');
    const b = computeFingerprint('Error', 'login failed');
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('스택 없을 때 uuid/hex 같은 가변 토큰도 정규화한다', () => {
    const a = computeFingerprint('Error', 'user 550e8400-e29b-41d4-a716-446655440000 not found');
    const b = computeFingerprint('Error', 'user 6ba7b810-9dad-11d1-80b4-00c04fd430c8 not found');
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});
