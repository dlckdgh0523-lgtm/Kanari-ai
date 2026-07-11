import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { RouteStat } from './route-stat.entity';
import { SlowSample } from './slow-sample.entity';

// SDK의 BUCKET_EDGES와 반드시 같아야 한다
export const BUCKET_EDGES = [10, 25, 50, 100, 250, 500, 1000, 3000];

export interface IncomingStat {
  method: string;
  route: string;
  count: number;
  errorCount: number;
  totalMs: number;
  maxMs: number;
  buckets: number[];
}

export interface IncomingSlow {
  method: string;
  route: string;
  durationMs: number;
  statusCode: number;
  traceId?: string;
  occurredAt?: string;
}

// 분포(버킷)에서 p95를 계산한다: 누적 개수가 95%를 넘는 첫 버킷의 상한선.
// 정확한 값이 아니라 "어느 구간에 있는가"지만, 알람 판단에는 그걸로 충분하다
export function p95FromBuckets(buckets: number[]): number {
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const target = total * 0.95;
  let cum = 0;
  for (let i = 0; i < buckets.length; i++) {
    cum += buckets[i];
    if (cum >= target) return BUCKET_EDGES[i] ?? 5000; // 마지막 칸은 3000ms 초과
  }
  return 5000;
}

@Injectable()
export class ApmService {
  private readonly logger = new Logger(ApmService.name);

  constructor(
    @InjectRepository(RouteStat)
    private readonly statRepo: Repository<RouteStat>,
    @InjectRepository(SlowSample)
    private readonly slowRepo: Repository<SlowSample>,
    private readonly projectsService: ProjectsService,
  ) {}

  // 워커(컨슈머)가 호출: 1분 집계를 저장한다
  async handleMetrics(
    projectId: number,
    stats: IncomingStat[],
    slow: IncomingSlow[],
  ) {
    // 분 단위로 절삭해서 같은 분의 집계는 한 행에 합쳐지게 한다
    const minute = new Date();
    minute.setSeconds(0, 0);

    for (const s of stats) {
      const existing = await this.statRepo.findOneBy({
        projectId,
        method: s.method,
        route: s.route,
        minute,
      });

      if (existing) {
        await this.statRepo.update(existing.id, {
          count: existing.count + s.count,
          errorCount: existing.errorCount + s.errorCount,
          totalMs: existing.totalMs + s.totalMs,
          maxMs: Math.max(existing.maxMs, s.maxMs),
          buckets: existing.buckets.map((v, i) => v + (s.buckets[i] ?? 0)),
        });
      } else {
        await this.statRepo.save({ projectId, minute, ...s });
      }
    }

    if (slow.length > 0) {
      await this.slowRepo.save(
        slow.map((x) => ({
          projectId,
          method: x.method,
          route: x.route,
          durationMs: x.durationMs,
          statusCode: x.statusCode,
          traceId: x.traceId ?? null,
          occurredAt: x.occurredAt ? new Date(x.occurredAt) : new Date(),
        })),
      );
    }

    this.logger.debug(
      `apm: project ${projectId} stats=${stats.length} slow=${slow.length}`,
    );
  }

  // 콘솔 APM 화면: 최근 1시간을 라우트별로 합산해 보여준다
  async overview(projectId: number, userId: number) {
    await this.projectsService.assertOwner(projectId, userId);

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await this.statRepo.findBy({
      projectId,
      minute: MoreThan(hourAgo),
    });

    // 라우트별 합산
    const byRoute = new Map<string, RouteStat[]>();
    for (const r of rows) {
      const key = r.method + ' ' + r.route;
      if (!byRoute.has(key)) byRoute.set(key, []);
      byRoute.get(key)!.push(r);
    }

    const routes = [...byRoute.entries()]
      .map(([key, list]) => {
        const buckets = new Array(BUCKET_EDGES.length + 1).fill(0);
        let count = 0, errorCount = 0, totalMs = 0, maxMs = 0;
        for (const r of list) {
          count += r.count;
          errorCount += r.errorCount;
          totalMs += r.totalMs;
          maxMs = Math.max(maxMs, r.maxMs);
          r.buckets.forEach((v, i) => (buckets[i] += v));
        }
        return {
          key,
          count,
          errorRate: count ? Math.round((errorCount / count) * 1000) / 10 : 0,
          avgMs: count ? Math.round(totalMs / count) : 0,
          p95Ms: p95FromBuckets(buckets),
          maxMs,
        };
      })
      .sort((a, b) => b.count - a.count);

    const slowSamples = await this.slowRepo.find({
      where: { projectId },
      order: { occurredAt: 'DESC' },
      take: 20,
    });

    return { routes, slowSamples };
  }
}
