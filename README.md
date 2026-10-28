# 🌱 코파일럿 마을 · Copilot Virtual Office

실행 중인 **GitHub Copilot CLI 세션**을 파스텔색 2D 일러스트 마을로 실시간 시각화합니다.
둥근 동물 친구들이 작은 작업실, 아이디어 텃밭, 커피 테이블, 피크닉 공간에서 일하고 쉽니다.
외부 이미지나 그래픽 라이브러리 없이 Canvas 곡선과 도형으로 그립니다.

## 실행

```bash
npm install
npm start          # http://localhost:4780 (PORT 환경변수로 변경 가능)
```

터미널에서 `copilot` 세션을 열면 친구가 마을에 찾아옵니다.

- **밤 풍경 / 낮 풍경** 버튼으로 테마를 전환합니다. 선택은 브라우저에 저장됩니다.
- `http://localhost:4780/?demo=1`은 실제 세션에 데모 친구 3명을 추가합니다. 상단에 `데모 포함`이 표시됩니다.
- `?demo=1&theme=day` 또는 `?demo=1&theme=night`로 처음 표시할 테마를 지정할 수 있습니다.
- 작은 화면에서는 마을 영역을 좌우로 스크롤할 수 있습니다.
- 운영체제의 동작 줄이기 설정에서는 산책과 반복 움직임을 줄입니다.

## 동작 원리

| 마을 표현 | 데이터 소스 |
|---|---|
| 동물 친구 (최대 7명, 초과 인원은 상단에 대기 표시) | `~/.copilot/session-state/<id>/events.jsonl` 라이브 세션 |
| 출근/퇴근 | `inuse.<pid>.lock` 파일의 PID 생존 여부 |
| 노트북과 작업 말풍선 | `tool.execution_start` (bash/edit/view 등) |
| 생각하는 표정과 요청 말풍선 | `assistant.turn_start`, 사용자 요청 |
| 체크 효과 | 도구 실행 완료에 따른 실행 횟수 증가 |
| 하트 효과 | 턴 종료 후 유휴 상태 전환 |
| 커피 산책 (작업이 들어오면 복귀) | 유휴 상태 |
| 잠자는 표정과 Zzz | 3분 이상 유휴 |
| 작은 도우미 친구 (세션당 최대 4명) | `subagent.started` / `subagent.completed` |
| 상주 동물 친구 | 세션 데이터와 무관한 배경 캐릭터 |
| 하단 마을 소식 | 최근 도구 호출·메시지 피드 |

캐릭터의 색상 표식은 모델 벤더를 나타냅니다 (Claude: 갈색 / GPT: 초록 / Gemini: 파랑).
캐릭터 종류와 몸 색은 세션 ID에 따라 정해지며, 이름표와 말풍선은 이동하는 친구를 따라갑니다.

## 구조

```text
server.js        # 정적 서빙 + WebSocket 브로드캐스트
lib/watcher.js   # 세션 디렉터리 폴링 + events.jsonl tail
lib/state.js     # 이벤트 → 친구 상태머신
public/office.js # 2D 일러스트, 캐릭터 동작, 마을 좌표와 화면 좌표 변환
public/app.js    # WS 클라이언트, 이름표/말풍선, 테마/데모, 연결 상태
public/index.html # 마을 화면, 안내 UI, 반응형 스타일
```

의존성은 `ws` 하나뿐입니다. Copilot 데이터를 읽기만 하며 수정하지 않습니다.
