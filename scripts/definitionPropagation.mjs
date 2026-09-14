// WHY: 정의서 버전(현재)이 spec이 기반한 버전(basedOnDefinition)보다 크면 spec이 낡음.
// basedOnDefinition은 정수(구 소비처) 또는 extractBasedOnDefinition이 반환하는 객체(신규격)
// 둘 다 받는다. 객체면 .version으로 정규화(객체는 valueOf도 version을 돌려주지만 명시적으로 정규화).
export function isStale(basedOnDefinition, currentVersion) {
  const based =
    basedOnDefinition && typeof basedOnDefinition === 'object'
      ? basedOnDefinition.version
      : basedOnDefinition;
  return currentVersion > based;
}

// WHY: 전파 점검의 spec측 입력 소스. spec 헤더의 basedOnDefinition 마커를 꺼낸다.
// 두 규격을 모두 파싱한다(하위호환):
//   ① 신규격(경로형): <!-- basedOnDefinition: <상대경로>@v<N> | IF-a,IF-b,... -->
//      경로(어느 정의서)·버전(낡음 판정)·IF 리스트(전파 결속)를 한 마커에 담는다.
//   ② 구 정수형:      <!-- basedOnDefinition: N -->  (dt-spec 게이트가 buildSpecHeader로 써넣던 형식)
// 반환은 { version, path?, ifIds? } 객체로 통일하되, 기존 정수 소비처(isStale·산술 비교)가
// 깨지지 않게 valueOf()가 version(정수)을 돌려준다 — `current > based`, `assert.equal(x, N)` 등이 그대로 동작.
// 마커가 없으면(legacy spec) null → 전파 점검 대상 아님.
export function extractBasedOnDefinition(specMarkdown) {
  // ① 신규격(경로형) 우선 시도 — path에 @v<N>, 뒤에 옵셔널 " | IF 리스트".
  const pathForm = specMarkdown.match(
    /<!--\s*basedOnDefinition:\s*(\S+)@v(\d+)\s*(?:\|\s*([^>]*?)\s*)?-->/
  );
  if (pathForm) {
    const path = pathForm[1];
    const version = parseInt(pathForm[2], 10);
    const ifIds = pathForm[3]
      ? pathForm[3].split(',').map(s => s.trim()).filter(Boolean)
      : [];
    return makeBasedOnDefinition(version, path, ifIds);
  }
  // ② 구 정수형 폴백.
  const intForm = specMarkdown.match(/<!--\s*basedOnDefinition:\s*(\d+)\s*-->/);
  if (intForm) {
    return makeBasedOnDefinition(parseInt(intForm[1], 10));
  }
  return null;
}

// WHY: version을 valueOf로 노출해 정수처럼도, 객체처럼도 쓰이는 하위호환 반환값을 만든다.
// valueOf는 non-enumerable — deepEqual/JSON 직렬화가 version/path/ifIds만 보게 한다.
function makeBasedOnDefinition(version, path, ifIds) {
  const obj = { version };
  if (path !== undefined) obj.path = path;
  if (ifIds !== undefined) obj.ifIds = ifIds;
  Object.defineProperty(obj, 'valueOf', {
    value: () => version,
    enumerable: false
  });
  return obj;
}

// WHY: spec 본문의 <!-- from: SP-n|IF-n --> 역참조 ID들을 등장 순서대로 추출.
export function extractFromRefs(specMarkdown) {
  const re = /<!--\s*from:\s*((?:SP|IF)-\d+)\s*-->/g;
  const ids = [];
  let m;
  while ((m = re.exec(specMarkdown)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

// WHY: 바뀐 정의서 항목 중, 이 spec이 실제로 역참조하는 것만이 영향 대상.
// 결속 소스 2개를 합산(중복 제거):
//   ① 주 소스 — 본문 <!-- from: SP-n|IF-n --> 역참조(BE leaf가 심는다).
//   ② 보조 소스 — 신규격 basedOnDefinition 마커의 IF 리스트(FE leaf처럼 from 마커가 없는 곳의 유일한 결속).
// 이로써 from 마커가 전무한 FE 페이지 spec도 전파망에 들어온다(끊김 #1 해소).
export function computeImpacted(changedIds, specMarkdown) {
  const refs = new Set(extractFromRefs(specMarkdown));
  const based = extractBasedOnDefinition(specMarkdown);
  if (based && Array.isArray(based.ifIds)) {
    for (const id of based.ifIds) refs.add(id);
  }
  return changedIds.filter(id => refs.has(id));
}

// WHY: 아래→위(스펙→정의서) 정합. leaf가 deep-read로 얻은 실제 계약과 정의서 IF를
// 구조적으로 비교해 누락 요청 파라미터·메서드/상태코드 모순을 뽑는다.
// 의미 판단(이 필터/정렬 규칙이 실제로 누락인가)은 SKILL이 deep-read 텍스트로 수행한다.
// 순수 함수, 부수효과 없음. 입력은 SKILL이 구성한 구조화 계약:
//   { method?: string, requestParams?: string[], statusCodes?: (string|number)[] }
export function detectDrift(definitionIF, deepReadContract) {
  const def = definitionIF ?? {};
  const read = deepReadContract ?? {};

  // missing = 실제 계약엔 있으나 정의서 IF엔 없는 요청 파라미터
  const defParams = new Set(def.requestParams ?? []);
  const missing = (read.requestParams ?? []).filter(p => !defParams.has(p));

  const conflicting = [];
  // 메서드 불일치
  if (def.method && read.method && def.method !== read.method) {
    conflicting.push(`method: ${def.method}≠${read.method}`);
  }
  // 실제 계약엔 있으나 정의서 IF엔 없는 상태코드
  const defCodes = new Set((def.statusCodes ?? []).map(String));
  for (const code of (read.statusCodes ?? []).map(String)) {
    if (!defCodes.has(code)) conflicting.push(`status: ${code}`);
  }

  // 응답 shape 필드 diff (R6 가드): 양쪽 모두 responseFields가 있을 때만 비교한다.
  // 한쪽에만 있으면(BE-only 미수거 IF 등 한쪽에 DM 참조 없음) "전부 drift" 오탐을 막으려 건너뛴다.
  if (Array.isArray(def.responseFields) && Array.isArray(read.responseFields)) {
    const defFields = new Set(def.responseFields);
    for (const f of read.responseFields) {
      if (!defFields.has(f)) conflicting.push(`shape: 응답 필드 '${f}' 정의서 DM 누락`);
    }
  }

  return { missing, conflicting };
}
