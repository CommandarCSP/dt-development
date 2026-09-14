---
ruleId: avoid-effect-for-derived-state
summary: "prop/state로 즉시 계산 가능한 값은 useEffect로 동기화 X — derived state로 즉시 계산"
severity: important
appliesTo: ["src/**/*.{tsx,ts}"]
detection:
  - type: ast-rule
    description: "useEffect 안에서 prop/state를 그대로 다른 state에 set하는 패턴은 derived state로 대체. (이 검사는 Plan 2에서 구현)"
source: "vercel-labs/agent-skills/skills/react-best-practices"
placeholder: true
---

# Derived state는 useEffect 대신 직접 계산

파생 값(derived value)을 별도의 state로 저장하고 useEffect로 동기화하는 패턴을 피한다.
대신 렌더 중에 직접 계산한다.

## 왜 중요한가

- useEffect 동기화는 렌더 사이클을 한 번 더 발생시켜 불필요한 flicker를 유발한다.
- 파생 값을 별도 state로 관리하면 버그 표면이 증가하고 추적이 어려워진다.

## ❌ Incorrect

```tsx
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);
```

## ✅ Correct

```tsx
const fullName = `${first} ${last}`;
```

## 예외

외부 시스템과의 동기화(애니메이션, 서드파티 라이브러리, 브라우저 API)는 useEffect가 적절하다.
단순히 prop/state로부터 값을 계산하는 경우에는 사용하지 않는다.
