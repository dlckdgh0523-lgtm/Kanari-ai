import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorGroup } from '../events/error-group.entity';

// 유사 장애 검색 v1 (키워드 기반).
// 새 에러 그룹이 만들어질 때, 과거에 해결한 비슷한 장애를 찾아 알람에 붙인다.
// 새벽에 알람을 받은 사람이 "지난달에도 이거 있었네, 그때 풀 사이즈 올려서 해결했네"를
// 바로 보는 것이 목표다.
//
// 지금은 단어 겹침 점수로 찾는다. Phase 4 후반에 Qdrant 벡터 검색을 결합해
// 표현이 달라도 의미가 같은 장애까지 잡는 하이브리드로 확장한다.
@Injectable()
export class SimilarIncidentsService {
  constructor(
    @InjectRepository(ErrorGroup)
    private readonly groupRepo: Repository<ErrorGroup>,
  ) {}

  async findSimilar(
    projectId: number,
    name: string,
    message: string,
    topFrame: string,
  ): Promise<ErrorGroup[]> {
    // 해결 메모가 있는 그룹만 검색 대상이다. 메모 없는 과거 장애는 알려줘도 도움이 안 된다
    const resolved = await this.groupRepo
      .createQueryBuilder('g')
      .where('g.projectId = :projectId', { projectId })
      .andWhere('g.status = :status', { status: 'resolved' })
      .andWhere('g.resolveNote IS NOT NULL')
      .orderBy('g.resolvedAt', 'DESC')
      .take(200) // 최근 200건 안에서만 찾는다 (전수 스캔 방지)
      .getMany();

    const targetTokens = tokenize(name + ' ' + message);

    const scored = resolved
      .map((g) => ({ group: g, score: this.score(g, name, topFrame, targetTokens) }))
      .filter((s) => s.score >= 4) // 어중간한 유사도는 소음이다. 확실한 것만
      .sort((a, b) => b.score - a.score)
      .slice(0, 2); // 알람에는 최대 2건만. 많이 보여줄수록 아무것도 안 읽게 된다

    return scored.map((s) => s.group);
  }

  private score(
    past: ErrorGroup,
    name: string,
    topFrame: string,
    targetTokens: Set<string>,
  ): number {
    let score = 0;

    // 같은 에러 클래스(TypeError 등)는 강한 신호
    if (past.name === name) score += 3;

    // 같은 파일에서 터졌으면 더 강한 신호
    if (topFrame && past.topFrame === topFrame) score += 4;

    // 메시지 단어 겹침: 겹친 단어 수 / 대상 단어 수
    const pastTokens = tokenize(past.name + ' ' + past.message);
    let overlap = 0;
    for (const t of targetTokens) {
      if (pastTokens.has(t)) overlap += 1;
    }
    if (targetTokens.size > 0) {
      score += Math.round((overlap / targetTokens.size) * 4);
    }

    return score;
  }
}

// 메시지를 검색 가능한 단어 집합으로 바꾼다. 숫자와 짧은 단어는 버린다
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z가-힣]+/)
      .filter((t) => t.length >= 3),
  );
}
