import { BUCKET_EDGES, p95FromBuckets } from './apm.service';

// p95는 지연 알람의 판단 기준이다. 버킷 분포에서 뽑아내는 로직이
// 틀리면 느려짐 알람이 헛울리거나 못 울린다.
describe('p95FromBuckets', () => {
  it('빈 분포는 0이다', () => {
    expect(p95FromBuckets(new Array(BUCKET_EDGES.length + 1).fill(0))).toBe(0);
  });

  it('전부 첫 버킷(10ms 이하)이면 p95는 10ms 구간이다', () => {
    const b = new Array(BUCKET_EDGES.length + 1).fill(0);
    b[0] = 100;
    expect(p95FromBuckets(b)).toBe(10);
  });

  it('95%가 빠르고 5%만 느리면 p95는 빠른 쪽 경계에 잡힌다', () => {
    // 95건이 10ms 이하, 5건이 3000ms 초과
    const b = new Array(BUCKET_EDGES.length + 1).fill(0);
    b[0] = 95;
    b[BUCKET_EDGES.length] = 5;
    // 누적 95%가 첫 버킷에서 채워지므로 10ms
    expect(p95FromBuckets(b)).toBe(10);
  });

  it('절반이 느리면 p95는 느린 구간으로 올라간다', () => {
    const b = new Array(BUCKET_EDGES.length + 1).fill(0);
    b[0] = 50; // 10ms 이하 50건
    b[6] = 50; // 1000ms 이하 50건
    // 누적 95%는 두 번째 덩어리 안 -> 1000ms 구간
    expect(p95FromBuckets(b)).toBe(1000);
  });
});
