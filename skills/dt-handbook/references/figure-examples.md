# 참조: 손 SVG 견본 세 장

> 소비처: `agents/handbook-author.md`. 집필 워커는 빈 종이가 아니라 이 세 장을 본떠 채운다.
> 도형 키트: `${CLAUDE_PLUGIN_ROOT}/templates/handbook-figures.css`.

## 규칙 (견본을 고칠 때도 지킨다)

- **이름이 아니라 작동 방식을 그린다.** `[캐시]` 박스 하나는 글보다 못하다. 그 상자가 무엇 사이에 앉아 있고 무엇이 지나가는지를 그린다.
- **화살표에 라벨을 단다.** 라벨 없는 화살표는 "무슨 관계 있음"일 뿐이고, `IPC 로 요청` 은 정보다.
- **한 그림에 한 주장.** `<figcaption>` 에 그 주장을 글로도 적는다. 캡션이 안 써지면 그림이 두 가지를 하고 있는 것이다.
- **클래스만 쓴다.** 인라인 `style` 로 색을 칠하지 않는다. 흑백 인쇄에서 구분이 사라진다.
- **8px 그리드.** 좌표를 8의 배수로 맞춘다. 눈대중 어긋남이 아마추어 티의 대부분이다.
- **`viewBox` 로 크기를 정한다.** `width`·`height` 속성을 쓰지 않는다. A4 폭을 넘으면 G5 가 막는다. 폭 640 안쪽이 안전하다.
- 강조색(`hb-arrow-accent`·`hb-badge`)은 **문서 전체에서 한 가지 뜻**으로만 쓴다.
- SVG 안에 `<script>`·`<style>`·`<foreignObject>` 를 넣지 않는다(G5).
- `role="img"` 와 `aria-label` 을 단다.

---

## ① 표지

제품명·버전·생성일이 들어가는 틀. 굵은 가로선 하나와 글자만으로 만든다. 표지에 그림을 그리면 본문 그림과 경쟁한다.

```
<figure>
<svg viewBox="0 0 640 260" role="img" aria-label="표지 — 제품명과 버전">
  <line class="hb-arrow-accent" x1="0" y1="48" x2="640" y2="48"/>
  <text class="hb-t" x="0" y="120" style="font-size:34px;font-weight:700">{{제품명}}</text>
  <text class="hb-t" x="0" y="160" style="font-size:20px">개발 핸드북</text>
  <text class="hb-t-s" x="0" y="200">버전 {{버전}} · {{생성일}}</text>
  <text class="hb-t-s" x="0" y="224">{{전권 또는 발췌 표시}}</text>
  <line class="hb-boundary" x1="0" y1="248" x2="640" y2="248"/>
</svg>
<figcaption>이 문서가 어느 판의 코드를 설명하는지 밝힌다.</figcaption>
</figure>
```

크기는 자리표시자다. 글자 크기만 인라인으로 두는 것은 허용한다(색이 아니라 크기라 흑백에서 문제가 없다).

## ② 5분 요약 — 큰 덩어리 지도

사용자에서 시작해 앱의 큰 덩어리를 지나 저장소·외부까지. 화살표마다 무엇이 오가는지 적는다.

```
<figure>
<svg viewBox="0 0 640 240" role="img" aria-label="사용자 요청이 화면·본체·저장소를 지나는 경로">
  <rect class="hb-boundary" x="120" y="24" width="360" height="152" rx="6"/>
  <text class="hb-t-s" x="128" y="44">앱 경계</text>

  <rect class="hb-ext" x="8" y="72" width="96" height="56" rx="4"/>
  <text class="hb-t" x="56" y="106" text-anchor="middle">사용자</text>

  <rect class="hb-box" x="144" y="72" width="128" height="56" rx="4"/>
  <text class="hb-t" x="208" y="98" text-anchor="middle">화면</text>
  <text class="hb-t-s" x="208" y="116" text-anchor="middle">렌더러</text>

  <rect class="hb-box" x="328" y="72" width="128" height="56" rx="4"/>
  <text class="hb-t" x="392" y="98" text-anchor="middle">본체</text>
  <text class="hb-t-s" x="392" y="116" text-anchor="middle">메인 프로세스</text>

  <rect class="hb-store" x="512" y="72" width="120" height="56" rx="4"/>
  <text class="hb-t" x="572" y="106" text-anchor="middle">보관함</text>

  <line class="hb-arrow" x1="104" y1="100" x2="142" y2="100"/>
  <text class="hb-t-s" x="123" y="92" text-anchor="middle">조작</text>

  <line class="hb-arrow-accent" x1="272" y1="100" x2="326" y2="100"/>
  <text class="hb-t-s" x="299" y="92" text-anchor="middle">IPC 요청</text>

  <line class="hb-arrow" x1="456" y1="100" x2="510" y2="100"/>
  <text class="hb-t-s" x="483" y="92" text-anchor="middle">파일 읽기·쓰기</text>

  <rect class="hb-note" x="144" y="184" width="312" height="40" rx="4"/>
  <text class="hb-t-s" x="156" y="209">화면은 파일에 직접 손대지 않는다 — 권한을 본체 한곳에 모은다.</text>
</svg>
<figcaption>사용자 조작은 화면을 거쳐 IPC 로 본체에 넘어가고, 파일 접근은 본체만 한다.</figcaption>
</figure>
```

강조 화살표(`hb-arrow-accent`)는 경계를 넘는 한 곳에만 썼다. 그게 이 그림의 주장이다.

## ③ 데이터 주체 지도

데이터마다 주인이 누구이고 어디에 사는지. **주인이 둘인 데이터는 이 그림에서 눈에 띄어야 한다.**

```
<figure>
<svg viewBox="0 0 640 264" role="img" aria-label="데이터별 주인과 저장소, 주인이 둘인 데이터 표시">
  <text class="hb-t-s" x="8" y="20">쓰는 쪽</text>
  <text class="hb-t-s" x="424" y="20">사는 곳</text>
  <line class="hb-lane" x1="0" y1="28" x2="640" y2="28"/>

  <rect class="hb-box" x="8" y="48" width="152" height="48" rx="4"/>
  <text class="hb-t" x="84" y="78" text-anchor="middle">문서 서비스</text>
  <rect class="hb-store" x="424" y="48" width="152" height="48" rx="4"/>
  <text class="hb-t" x="500" y="78" text-anchor="middle">문서 파일</text>
  <line class="hb-arrow" x1="160" y1="72" x2="422" y2="72"/>
  <text class="hb-t-s" x="291" y="64" text-anchor="middle">저장·삭제</text>

  <rect class="hb-box" x="8" y="120" width="152" height="48" rx="4"/>
  <text class="hb-t" x="84" y="150" text-anchor="middle">색인 작업자</text>
  <rect class="hb-box" x="8" y="184" width="152" height="48" rx="4"/>
  <text class="hb-t" x="84" y="214" text-anchor="middle">이관 스크립트</text>
  <rect class="hb-store" x="424" y="152" width="152" height="48" rx="4"/>
  <text class="hb-t" x="500" y="182" text-anchor="middle">검색 색인</text>

  <line class="hb-arrow-accent" x1="160" y1="144" x2="422" y2="170"/>
  <line class="hb-arrow-accent" x1="160" y1="208" x2="422" y2="182"/>
  <circle class="hb-badge" cx="300" cy="176" r="11"/>
  <text class="hb-t-badge" x="300" y="180" text-anchor="middle">2</text>
  <text class="hb-t-s" x="300" y="212" text-anchor="middle">주인이 둘</text>
</svg>
<figcaption>검색 색인에는 쓰는 쪽이 둘이다 — 색인 작업자와 이관 스크립트가 순서 없이 쓴다.</figcaption>
</figure>
```

여기서도 강조색은 한 가지 뜻으로만 쓴다. "여기가 문제다".
