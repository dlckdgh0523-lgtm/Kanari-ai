import { Link } from 'react-router-dom';
import { getToken } from '../api';

// 랜딩: 이 서비스가 뭔지, 어떻게 붙이는지를 한 화면에서 설명한다.
// 히어로는 제품 그 자체를 보여준다 - 에러가 나고, 카나리가 우는 순간의 터미널.
export function Landing() {
  const loggedIn = !!getToken();

  return (
    <div className="landing">
      <div className="statusbar">
        <span>
          <span className="host">kanari</span>
          <span className="dim">@web</span>
        </span>
        <span className="right">
          <a
            href="https://github.com/dlckdgh0523-lgtm/Kanari-ai"
            target="_blank"
            rel="noreferrer"
            className="dim"
          >
            GitHub
          </a>
          <Link to={loggedIn ? '/console' : '/login'} className="cta-link">
            {loggedIn ? '콘솔로 이동' : '로그인'}
          </Link>
        </span>
      </div>

      <div className="page">
        {/* ---------- 히어로 ---------- */}
        <section className="hero">
          <h1>
            <span className="bird">◗</span> 사람보다 먼저
            <br />
            장애를 감지하는 카나리아
            <span className="cursor" />
          </h1>
          <p className="hero-sub">
            옛날 광부들은 탄광에 카나리아를 데려갔습니다. 위험이 차오르면
            사람보다 새가 먼저 알았으니까요. 카나리는 당신의 Node.js 서버에
            사는 카나리아입니다. 사용자가 제보하기 전에, 에러를 모아 묶고
            Discord로 알려줍니다.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn">
              무료로 시작하기
            </Link>
            <a href="#how" className="btn ghost">
              어떻게 쓰나요?
            </a>
          </div>

          {/* 제품이 일하는 순간을 그대로 보여주는 터미널 */}
          <div className="term hero-term">
            <span className="line dim"># 당신의 서버, 새벽 2시</span>
            <span className="line">
              <span className="t">02:14:07</span>{' '}
              <span className="lv-error">ERROR</span> TypeError: Cannot read
              properties of undefined (reading id)
            </span>
            <span className="line">
              <span className="t">02:14:09</span>{' '}
              <span className="lv-error">ERROR</span> TypeError: Cannot read
              properties of undefined (reading id)
            </span>
            <span className="line dim"># 같은 시각, 당신의 Discord</span>
            <span className="line">
              <span className="bird">🐤</span> 새로운 에러 · 그룹 #12 · 위치:
              userservice.find src/users/users.service.ts
            </span>
            <span className="line">
              <span className="dim">📚 비슷한 과거 장애 #7 · 해결 메모: user
              조회 결과 null 체크 추가로 해결</span>
            </span>
          </div>
        </section>

        {/* ---------- 사용법 ---------- */}
        <section id="how">
          <div className="prompt-line">
            <span className="chevron">❯</span>
            <span className="cmd">kanari setup</span>
            <span className="dim"> # 붙이는 데 3분이면 됩니다</span>
          </div>

          <div className="steps">
            <div className="panel step">
              <div className="step-no">1</div>
              <b>가입하고 프로젝트를 만드세요</b>
              <p className="dim">
                감시할 서비스 이름을 등록하면 API 키(kn_...)가 발급됩니다. 키는
                발급 순간 한 번만 보여드리니 바로 복사해 두세요.
              </p>
            </div>
            <div className="panel step">
              <div className="step-no">2</div>
              <b>서버에 SDK를 붙이세요</b>
              <pre className="stack">{`npm install kanari winston

import { KanariTransport } from 'kanari';

logger.add(new KanariTransport({
  apiKey: process.env.KANARI_API_KEY,
  captureGlobalErrors: true, // 놓친 예외까지 자동 포착
}));`}</pre>
              <p className="dim">
                이미 쓰던 logger.error가 전부 카나리로 모입니다. 배포 환경의
                환경변수에 키를 넣으면 끝입니다.
              </p>
            </div>
            <div className="panel step">
              <div className="step-no">3</div>
              <b>Discord 웹훅을 연결하세요</b>
              <p className="dim">
                프로젝트 설정에서 웹훅 URL을 등록하면, 새 에러와 급증이 알람으로
                날아옵니다. 콘솔에서는 에러 인박스와 실시간 로그를 볼 수
                있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- 핵심 기능 ---------- */}
        <section>
          <div className="prompt-line">
            <span className="chevron">❯</span>
            <span className="cmd">kanari features</span>
          </div>
          <div className="features">
            <div className="panel">
              <b>같은 에러 1,000건 = 알람 1건</b>
              <p className="dim">
                스택트레이스 지문으로 같은 원인끼리 묶습니다. 알람이 스팸이 되면
                아무도 안 읽으니까요.
              </p>
            </div>
            <div className="panel">
              <b>200이 떠도 장애는 잡습니다</b>
              <p className="dim">
                등록한 핵심 API를 주기적으로 실제 호출하는 합성 테스트가 핑
                모니터링이 못 보는 장애를 잡습니다.
              </p>
            </div>
            <div className="panel">
              <b>평소의 3배면 급증 알람</b>
              <p className="dim">
                1분마다 도는 워치독이 발생률을 기준선과 비교합니다. 새 에러가
                아니어도 커지는 문제는 알려드립니다.
              </p>
            </div>
            <div className="panel">
              <b>고친 방법이 쌓입니다</b>
              <p className="dim">
                에러를 해결하며 남긴 메모가 지식베이스가 됩니다. 비슷한 에러가
                다시 나면 지난번 해결법이 알람에 함께 옵니다.
              </p>
            </div>
          </div>
        </section>

        <footer className="landing-footer dim">
          kanari · 에러 관제 서비스 ·{' '}
          <a
            href="https://www.npmjs.com/package/kanari"
            target="_blank"
            rel="noreferrer"
          >
            npm
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/dlckdgh0523-lgtm/Kanari-ai"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}
