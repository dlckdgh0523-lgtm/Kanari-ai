import { Injectable, Logger } from '@nestjs/common';
import {
  buildBlobLink,
  parseGitHubRepo,
  parseTopAppFrame,
  SourceLocation,
} from './source-location';

export interface SuspectResult {
  location: SourceLocation | null;
  blobLink: string | null;
  // 이 파일을 마지막으로 바꾼 커밋 = 유력 용의자 (line 단위 blame이 아니라 file 단위 근사)
  suspectCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  } | null;
  note: string;
}

// 에러가 난 위치에서 "누가 범인인가"를 추정한다.
// 정확한 line-blame은 GitHub GraphQL + 인증이 필요해 무겁다. 여기서는
// REST로 "그 파일을 마지막으로 건드린 커밋"을 찾는다 - 대부분의 경우 이게 범인이다.
// 정직하게 file 단위 근사임을 note로 알린다.
@Injectable()
export class SuspectService {
  private readonly logger = new Logger(SuspectService.name);

  async findSuspect(
    stack: string | null,
    repoUrl: string | null,
    release: string | null,
  ): Promise<SuspectResult> {
    const location = parseTopAppFrame(stack ?? undefined);
    const repo = parseGitHubRepo(repoUrl);

    if (!location) {
      return { location: null, blobLink: null, suspectCommit: null, note: '스택에서 우리 코드 위치를 찾지 못했습니다' };
    }
    if (!repo) {
      return {
        location,
        blobLink: null,
        suspectCommit: null,
        note: 'GitHub 저장소를 연결하면 코드 링크와 용의자 커밋을 찾아드립니다',
      };
    }

    const blobLink = repoUrl ? buildBlobLink(repoUrl, location, release) : null;

    // GitHub REST: 이 파일을 건드린 커밋 목록 (최신 1개). 공개 저장소는 토큰 없이 가능(시간당 60회)
    try {
      const params = new URLSearchParams({ path: location.file, per_page: '1' });
      if (release) params.set('sha', release);
      const res = await fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?${params}`,
        {
          headers: { accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(6000),
        },
      );

      if (!res.ok) {
        return {
          location,
          blobLink,
          suspectCommit: null,
          note:
            res.status === 403
              ? 'GitHub API 호출 한도(시간당 60회)를 넘었습니다. 잠시 후 다시 시도하세요'
              : `GitHub에서 커밋을 찾지 못했습니다 (${res.status})`,
        };
      }

      const commits = (await res.json()) as Array<{
        sha: string;
        html_url: string;
        commit: { message: string; author: { name: string; date: string } };
      }>;

      if (commits.length === 0) {
        return { location, blobLink, suspectCommit: null, note: '해당 파일의 커밋 기록을 찾지 못했습니다' };
      }

      const c = commits[0];
      return {
        location,
        blobLink,
        suspectCommit: {
          sha: c.sha.slice(0, 8),
          message: c.commit.message.split('\n')[0].slice(0, 120),
          author: c.commit.author.name,
          date: c.commit.author.date,
          url: c.html_url,
        },
        note: `${location.file}을 마지막으로 바꾼 커밋입니다 (파일 단위 추정)`,
      };
    } catch (err) {
      this.logger.warn(`suspect lookup failed: ${err}`);
      return { location, blobLink, suspectCommit: null, note: 'GitHub 조회 중 오류가 발생했습니다' };
    }
  }
}
